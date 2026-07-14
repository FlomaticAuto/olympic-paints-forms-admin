import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

const LEAD_COLS =
  'id,lead_ref,company,contact_person,phone,mobile,email,lead_source,lead_status,distance,street,city,province,postal_code,rep,notes,created_at';

// GET /api/resin-leads/lead — list all leads (the "Leads Loaded" view), each
// with its edit history attached (newest first) so Kim can see what changed.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('resin_leads')
    .select(LEAD_COLS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[resin-leads/lead GET]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  const leads = (data ?? []) as Array<Record<string, unknown>>;
  // Attach edit history in one round-trip (best-effort).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: editRows } = await (db as any)
      .from('resin_lead_edits')
      .select('id,lead_id,edited_by,changes,edited_at')
      .order('edited_at', { ascending: false });
    const byLead = new Map<string, unknown[]>();
    for (const e of (editRows ?? []) as Array<{ lead_id: string }>) {
      const arr = byLead.get(e.lead_id) ?? [];
      arr.push(e);
      byLead.set(e.lead_id, arr);
    }
    for (const l of leads) l.edits = byLead.get(l.id as string) ?? [];
  } catch { /* edits are best-effort */ }

  return NextResponse.json(leads, { headers: corsHeaders(origin) });
}

// POST /api/resin-leads/lead  — create a new lead (the "Capture Lead" mode).
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const company = String(body.company ?? '').trim();
  if (!company) {
    return NextResponse.json({ error: 'Company is required' }, { status: 400, headers: corsHeaders(origin) });
  }

  const distance = body.distance === 'Long Distance' ? 'Long Distance' : 'Local';

  const row = {
    company,
    contact_person: str(body.contact_person),
    phone:          str(body.phone),
    mobile:         str(body.mobile),
    email:          str(body.email),
    lead_source:    str(body.lead_source),
    lead_status:    str(body.lead_status) || 'New',
    distance,
    street:         str(body.street),
    city:           str(body.city),
    province:       str(body.province),
    postal_code:    str(body.postal_code),
    rep:            str(body.rep),
    notes:          str(body.notes),
  };

  const db = createServerClient();

  // Generate a human-friendly ref, retrying on the (rare) unique collision.
  for (let attempt = 0; attempt < 4; attempt++) {
    const lead_ref = genLeadRef();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
      .from('resin_leads')
      .insert({ ...row, lead_ref })
      .select('id,lead_ref')
      .single();

    if (!error && data) {
      return NextResponse.json(
        { id: data.id, lead_ref: data.lead_ref },
        { status: 201, headers: corsHeaders(origin) }
      );
    }
    // 23505 = unique_violation → retry with a fresh ref
    if (error && error.code !== '23505') {
      console.error('[resin-leads/lead]', error);
      return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
    }
  }

  return NextResponse.json({ error: 'Could not allocate a lead reference' }, { status: 500, headers: corsHeaders(origin) });
}

// PATCH /api/resin-leads/lead — edit an existing lead and record a field-level
// diff of what changed into resin_lead_edits.
// Body: { id, edited_by?, company, contact_person, phone, mobile, email,
//         lead_source, lead_status, distance, street, city, province,
//         postal_code, rep, notes }
export async function PATCH(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const id = String(body.id ?? '').trim();
  const company = String(body.company ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Missing lead id' }, { status: 400, headers: corsHeaders(origin) });
  if (!company) return NextResponse.json({ error: 'Company is required' }, { status: 400, headers: corsHeaders(origin) });

  const db = createServerClient();

  // Load the current row so we can diff against it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current, error: loadErr } = await (db as any)
    .from('resin_leads').select(LEAD_COLS).eq('id', id).maybeSingle();
  if (loadErr || !current) {
    console.error('[resin-leads/lead PATCH] load', loadErr);
    return NextResponse.json({ error: 'Lead not found' }, { status: 404, headers: corsHeaders(origin) });
  }

  const updated = {
    company,
    contact_person: str(body.contact_person),
    phone:          str(body.phone),
    mobile:         str(body.mobile),
    email:          str(body.email),
    lead_source:    str(body.lead_source),
    lead_status:    str(body.lead_status) || 'New',
    distance:       body.distance === 'Long Distance' ? 'Long Distance' : 'Local',
    street:         str(body.street),
    city:           str(body.city),
    province:       str(body.province),
    postal_code:    str(body.postal_code),
    rep:            str(body.rep),
    notes:          str(body.notes),
  };

  const changes = diffLead(current, updated);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (db as any).from('resin_leads').update(updated).eq('id', id);
  if (updErr) {
    console.error('[resin-leads/lead PATCH] update', updErr);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  // Record the edit (only if something actually changed) — best-effort.
  if (changes.length) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from('resin_lead_edits').insert({
        lead_id: id,
        lead_ref: current.lead_ref,
        edited_by: str(body.edited_by),
        changes,
      });
    } catch (e) {
      console.error('[resin-leads/lead PATCH] edit-log', e);
    }
  }

  return NextResponse.json({ ok: true, changed: changes.length }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' },
  });
}

interface Change { field: string; label: string; from: string; to: string }
const LEAD_FIELDS: Array<[string, string]> = [
  ['company', 'Company'],
  ['contact_person', 'Contact'],
  ['phone', 'Phone'],
  ['mobile', 'Mobile'],
  ['email', 'Email'],
  ['lead_source', 'Source'],
  ['lead_status', 'Status'],
  ['distance', 'Distance'],
  ['street', 'Street'],
  ['city', 'City'],
  ['province', 'Province'],
  ['postal_code', 'Postal Code'],
  ['rep', 'Rep'],
  ['notes', 'Notes'],
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function diffLead(current: Record<string, any>, updated: Record<string, any>): Change[] {
  const changes: Change[] = [];
  for (const [field, label] of LEAD_FIELDS) {
    const from = (current[field] ?? '') === '' ? '—' : String(current[field]);
    const to = (updated[field] ?? '') === '' ? '—' : String(updated[field]);
    if (from !== to) changes.push({ field, label, from, to });
  }
  return changes;
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}

function genLeadRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `RL-${yy}${mm}${dd}-${rnd}`;
}
