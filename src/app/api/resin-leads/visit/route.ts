import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// POST /api/resin-leads/visit — log a visit against an existing lead.
// Body: { lead_id, lead_ref, company, rep, visit_date, distance, outcome,
//         next_follow_up, notes, photos: string[], products: [line...] }
// Each line: { product_id, code, name, our_price, est_qty, order_every,
//              order_unit, current_supplier, current_supplier_price, notes }
// Side effects: any new current_supplier is added to resin_suppliers, and each
// line that names a current supplier records a row in resin_supplier_prices.
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const lead_id    = String(body.lead_id ?? '').trim();
  const company    = String(body.company ?? '').trim();
  const visit_date = String(body.visit_date ?? '').trim();
  if (!lead_id || !company || !visit_date) {
    return NextResponse.json({ error: 'Missing lead, company or visit date' }, { status: 400, headers: corsHeaders(origin) });
  }

  const distance = body.distance === 'Long Distance' ? 'Long Distance' : 'Local';
  const lead_ref = str(body.lead_ref) ?? '';

  const rawItems = Array.isArray(body.products) ? body.products : [];
  const products = rawItems
    .map((it) => {
      const r = it as Record<string, unknown>;
      const name = str(r.name);
      const product_id = str(r.product_id);
      if (!name && !product_id) return null;
      const our_price = num(r.our_price);
      const est_qty   = num(r.est_qty);
      return {
        product_id,
        code: str(r.code),
        name: name ?? '',
        our_price,
        est_qty,
        order_every: num(r.order_every),
        order_unit: str(r.order_unit),
        current_supplier: str(r.current_supplier),
        current_supplier_price: num(r.current_supplier_price),
        notes: str(r.notes),
        est_value: our_price != null && est_qty != null ? Math.round(our_price * est_qty * 100) / 100 : null,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const total = Math.round(
    products.reduce((s, p) => s + (typeof p.est_value === 'number' ? p.est_value : 0), 0) * 100
  ) / 100;

  const photos = Array.isArray(body.photos)
    ? (body.photos as unknown[]).filter((u): u is string => typeof u === 'string')
    : [];

  const visit_ref = genVisitRef();
  const row = {
    visit_ref, lead_id, lead_ref, company,
    rep: str(body.rep), visit_date, distance,
    outcome: str(body.outcome), next_follow_up: str(body.next_follow_up),
    products, total, notes: str(body.notes),
    photos: photos.length ? photos : null,
  };

  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('resin_lead_visits').insert(row).select('id,visit_ref,created_at').single();

  if (error || !data) {
    console.error('[resin-leads/visit]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  // Competitor intel: upsert suppliers + record their prices (best-effort, non-fatal).
  try {
    for (const p of products) {
      const supplier = p.current_supplier as string | null;
      if (!supplier) continue;
      const supplier_id = await upsertSupplier(db, supplier);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any).from('resin_supplier_prices').insert({
        supplier_id,
        supplier_name: supplier,
        product_id: (p.product_id as string) || null,
        product_name: (p.name as string) || '',
        price: p.current_supplier_price ?? null,
        distance,
        lead_id, lead_ref, visit_ref,
      });
    }
  } catch (e) {
    console.error('[resin-leads/visit] supplier capture', e);
  }

  // Advance the lead status to mirror the visit outcome (best-effort).
  const mapped = mapOutcomeToStatus(str(body.outcome));
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSupplier(db: any, name: string): Promise<string | null> {
  const { data: found } = await db.from('resin_suppliers').select('id').ilike('name', name).maybeSingle();
  if (found?.id) return found.id;
  const { data: ins, error } = await db.from('resin_suppliers').insert({ name }).select('id').single();
  if (!error && ins?.id) return ins.id;
  // race on unique(lower(name)) — re-select
  const { data: again } = await db.from('resin_suppliers').select('id').ilike('name', name).maybeSingle();
  return again?.id ?? null;
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
}
function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
