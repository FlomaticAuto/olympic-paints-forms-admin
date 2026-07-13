import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import { nextEstimateNumber } from '@/lib/resinEstimates/estimateNumber';
import { buildEstimateLineRows } from '@/lib/resinEstimates/estimateLines';
import type { RawEstimateLine } from '@/lib/resinEstimates/types';

// Public (unauthenticated, CORS) — same access model as the rest of
// /api/resin-leads. Lives inside the rep-facing Resins dashboard.

const EST_COLS =
  'id,estimate_number,client,contact_name,contact_email,contact_phone,site,date_issued,valid_until,status,price_basis,notes,terms,prepared_by,lead_id,lead_ref,created_at';

// GET — list estimates (newest first), each with its total attached.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  const { data, error } = await db
    .from('resin_estimates')
    .select(EST_COLS)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[resin-leads/estimate GET]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  const estimates = (data ?? []) as Array<Record<string, unknown>>;
  // attach totals in one round-trip
  try {
    const { data: lineRows } = await db
      .from('resin_estimate_lines').select('estimate_id, line_total');
    const totalByEst = new Map<string, number>();
    for (const r of (lineRows ?? []) as { estimate_id: string; line_total: number }[]) {
      totalByEst.set(r.estimate_id, (totalByEst.get(r.estimate_id) ?? 0) + Number(r.line_total || 0));
    }
    for (const e of estimates) {
      const sub = totalByEst.get(e.id as string) ?? 0;
      e.subtotal = sub;
      e.total = sub * 1.15;
    }
  } catch { /* totals are best-effort */ }

  return NextResponse.json(estimates, { headers: corsHeaders(origin) });
}

// POST — create an estimate + its lines. Body: header fields + lines[].
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const client = String(body.client ?? '').trim();
  if (!client) {
    return NextResponse.json({ error: 'Client is required' }, { status: 400, headers: corsHeaders(origin) });
  }
  const lines = Array.isArray(body.lines) ? (body.lines as RawEstimateLine[]) : [];

  const db = createServerClient();

  const s = (v: unknown) => { const t = typeof v === 'string' ? v.trim() : ''; return t || null; };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let estimate: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastErr: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const estimate_number = await nextEstimateNumber(db);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db.from('resin_estimates') as any)
      .insert({
        estimate_number,
        client,
        contact_name:  s(body.contact_name),
        contact_email: s(body.contact_email),
        contact_phone: s(body.contact_phone),
        site:          s(body.site),
        date_issued:   s(body.date_issued) ?? undefined,
        valid_until:   s(body.valid_until),
        price_basis:   (s(body.price_basis) as 'local' | 'long') ?? 'local',
        notes:         s(body.notes),
        terms:         s(body.terms),
        prepared_by:   s(body.prepared_by) ?? 'Kim Williams',
        lead_id:       s(body.lead_id),
        lead_ref:      s(body.lead_ref),
        status:        'draft',
      })
      .select(EST_COLS)
      .single();
    if (!error) { estimate = data; break; }
    lastErr = error;
    if (error.code !== '23505') break;
  }
  if (!estimate) {
    console.error('[resin-leads/estimate POST]', lastErr);
    return NextResponse.json({ error: lastErr?.message ?? 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  const rows = buildEstimateLineRows(lines, estimate.id);
  if (rows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lineErr } = await (db.from('resin_estimate_lines') as any).insert(rows);
    if (lineErr) {
      return NextResponse.json({ error: lineErr.message }, { status: 500, headers: corsHeaders(origin) });
    }
  }

  return NextResponse.json(estimate, { status: 201, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  });
}
