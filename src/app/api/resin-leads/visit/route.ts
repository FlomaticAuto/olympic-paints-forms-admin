import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import { priceFor, productByCode, type Distance } from '@/lib/resinProducts';

// POST /api/resin-leads/visit  — log a visit against an existing lead.
// Body: { lead_id, lead_ref, company, rep, visit_date, distance, outcome,
//         next_follow_up, notes, photos: string[], products: [{code, qty}] }
// Pricing is recomputed server-side from the catalogue (authoritative).
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const lead_id    = String(body.lead_id ?? '').trim();
  const company    = String(body.company ?? '').trim();
  const visit_date = String(body.visit_date ?? '').trim();
  if (!lead_id || !company || !visit_date) {
    return NextResponse.json({ error: 'Missing lead, company or visit date' }, { status: 400, headers: corsHeaders(origin) });
  }

  const distance: Distance = body.distance === 'Long Distance' ? 'Long Distance' : 'Local';

  // Rebuild line items from the catalogue so prices can't be tampered with.
  const rawItems = Array.isArray(body.products) ? body.products : [];
  const products = rawItems
    .map((it) => {
      const rec  = it as Record<string, unknown>;
      const code = String(rec.code ?? '').trim();
      const qty  = Number(rec.qty) || 0;
      const p    = productByCode(code);
      if (!p || qty <= 0) return null;
      const unit_price = priceFor(code, distance);
      return {
        code,
        name: p.name,
        distance,
        unit_price,
        qty,
        line_total: Math.round(unit_price * qty * 100) / 100,
      };
    })
    .filter(Boolean) as Array<{ line_total: number }>;

  const total = Math.round(products.reduce((s, p) => s + p.line_total, 0) * 100) / 100;

  const photos = Array.isArray(body.photos)
    ? (body.photos as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  const row = {
    visit_ref:      genVisitRef(),
    lead_id,
    lead_ref:       str(body.lead_ref) ?? '',
    company,
    rep:            str(body.rep),
    visit_date,
    distance,
    outcome:        str(body.outcome),
    next_follow_up: str(body.next_follow_up),
    products,
    total,
    notes:          str(body.notes),
    photos:         photos.length ? photos : null,
  };

  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('resin_lead_visits')
    .insert(row)
    .select('id,visit_ref,created_at')
    .single();

  if (error || !data) {
    console.error('[resin-leads/visit]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  // Advance the lead's status to reflect the latest visit outcome (best-effort).
  const mapped = mapOutcomeToStatus(row.outcome);
  if (mapped) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('resin_leads').update({ lead_status: mapped }).eq('id', lead_id);
  }

  return NextResponse.json(
    { visit_id: data.id, visit_ref: data.visit_ref, total },
    { status: 201, headers: corsHeaders(origin) }
  );
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

function mapOutcomeToStatus(outcome: string | null): string | null {
  switch (outcome) {
    case 'Quoted':        return 'Quoted';
    case 'Negotiating':   return 'Negotiating';
    case 'Order Placed':
    case 'Won':           return 'Won';
    case 'Not Interested':
    case 'Lost':          return 'Lost';
    case 'Sample Requested':
    case 'Introductory Meeting':
    case 'Follow-up Required': return 'Contacted';
    default:              return null;
  }
}

function genVisitRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `RV-${yy}${mm}${dd}-${rnd}`;
}
