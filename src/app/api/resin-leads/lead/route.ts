import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

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

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
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
