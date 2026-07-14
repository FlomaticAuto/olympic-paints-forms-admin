import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import { buildEstimateLineRows } from '@/lib/resinEstimates/estimateLines';
import type { RawEstimateLine } from '@/lib/resinEstimates/types';

// GET one estimate with its line items (public, CORS).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ estimate_id: string }> },
) {
  const origin = req.headers.get('origin');
  const { estimate_id } = await params;
  const db = createServerClient();

  const { data: estimate } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders(origin) });

  const { data: lines } = await db
    .from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');

  return NextResponse.json({ estimate, lines: lines ?? [] }, { headers: corsHeaders(origin) });
}

// PATCH — update a DRAFT estimate's header + line items (replace all lines).
// Sent estimates are locked so a customer-facing quote isn't silently altered.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ estimate_id: string }> },
) {
  const origin = req.headers.get('origin');
  const { estimate_id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const client = String(body.client ?? '').trim();
  if (!client) return NextResponse.json({ error: 'Client is required' }, { status: 400, headers: corsHeaders(origin) });

  const db = createServerClient();

  const { data: current } = await db.from('resin_estimates').select('id,status').eq('id', estimate_id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'Estimate not found' }, { status: 404, headers: corsHeaders(origin) });
  if ((current as { status: string }).status !== 'draft') {
    return NextResponse.json({ error: 'Only draft estimates can be edited.' }, { status: 409, headers: corsHeaders(origin) });
  }

  const s = (v: unknown) => { const t = typeof v === 'string' ? v.trim() : ''; return t || null; };
  const header = {
    client,
    contact_name:  s(body.contact_name),
    contact_email: s(body.contact_email),
    contact_phone: s(body.contact_phone),
    site:          s(body.site),
    valid_until:   s(body.valid_until),
    price_basis:   (s(body.price_basis) as 'local' | 'long') ?? 'local',
    notes:         s(body.notes),
    lead_id:       s(body.lead_id),
    lead_ref:      s(body.lead_ref),
    updated_at:    new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (db.from('resin_estimates') as any).update(header).eq('id', estimate_id);
  if (updErr) {
    console.error('[resin-leads/estimate PATCH] header', updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500, headers: corsHeaders(origin) });
  }

  // Replace line items: delete existing, re-insert from payload.
  await db.from('resin_estimate_lines').delete().eq('estimate_id', estimate_id);
  const lines = Array.isArray(body.lines) ? (body.lines as RawEstimateLine[]) : [];
  const rows = buildEstimateLineRows(lines, estimate_id);
  if (rows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lineErr } = await (db.from('resin_estimate_lines') as any).insert(rows);
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500, headers: corsHeaders(origin) });
  }

  return NextResponse.json({ ok: true, id: estimate_id }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS' },
  });
}
