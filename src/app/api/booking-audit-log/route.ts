import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// POST /api/booking-audit-log
// Primary: inserts into store_visit_bookings (Supabase).
// Secondary: forwards to local Excel webhook (fire-and-forget, non-fatal).

const WEBHOOK_URL = process.env.BOOKING_AUDIT_WEBHOOK_URL ?? '';

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: { data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const d = body.data ?? body as Record<string, unknown>;

  // ── Primary: write to Supabase store_visit_bookings ───────────────────────
  try {
    const db = createServerClient();
    const tasks = Array.isArray(d.tasks)
      ? d.tasks
      : typeof d.tasks === 'string' && d.tasks
        ? d.tasks.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [];

    const { error } = await (db as any).from('store_visit_bookings').insert({
      report_ref:    d.report_ref    ?? '',
      booked_by:     d.booked_by     ?? '',
      store_id:      d.store_id      ?? null,
      store_name:    d.store_name    ?? '',
      store_code:    d.store_code    ?? null,
      store_address: d.store_address ?? null,
      address_source: d.address_source ?? null,
      purpose:       d.purpose       ?? '',
      tasks,
      merchandiser:  d.merchandiser  ?? '',
      manager_name:  d.manager_name  ?? '',
      visit_date:    d.visit_date    ?? null,
      visit_time:    d.visit_time    ?? null,
      description:   d.description   ?? null,
      booking_status: 'Logged',
    });
    if (error) {
      console.error('[booking-audit-log] Supabase insert error:', error);
      return NextResponse.json({ error: 'Database write failed', detail: error.message }, { status: 500, headers: corsHeaders(origin) });
    }
  } catch (err) {
    console.error('[booking-audit-log] Supabase unexpected error:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500, headers: corsHeaders(origin) });
  }

  // ── Secondary: Excel webhook (best-effort) ────────────────────────────────
  if (WEBHOOK_URL) {
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    }).catch(err => console.warn('[booking-audit-log] Excel webhook unreachable:', err));
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}
