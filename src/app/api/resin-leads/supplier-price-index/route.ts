import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/resin-leads/supplier-price-index
// Aggregates captured competitor prices into a reference index:
//   [{ supplier, product, last, avg, count, last_at }]
// Used to SHOW the last/average price per selected supplier+product — the form's
// price inputs are never auto-filled; the rep always types the confirmed value.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  const { data, error } = await db
    .from('resin_supplier_prices')
    .select('supplier_name,product_name,price,captured_at')
    .not('price', 'is', null)
    .order('captured_at', { ascending: true });

  if (error) {
    console.error('[resin-leads/supplier-price-index]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  interface Acc { supplier: string; product: string; sum: number; count: number; last: number; last_at: string }
  const map = new Map<string, Acc>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const supplier = String(r.supplier_name ?? '').trim();
    const product = String(r.product_name ?? '').trim();
    const price = Number(r.price);
    if (!supplier || !product || !Number.isFinite(price)) continue;
    const key = `${supplier.toLowerCase()}|${product.toLowerCase()}`;
    const e = map.get(key) ?? { supplier, product, sum: 0, count: 0, last: price, last_at: '' };
    e.sum += price;
    e.count += 1;
    e.last = price;                       // rows are ordered ascending → last wins
    e.last_at = String(r.captured_at ?? '');
    map.set(key, e);
  }

  const out = Array.from(map.values()).map((e) => ({
    supplier: e.supplier,
    product: e.product,
    last: e.last,
    avg: Math.round((e.sum / e.count) * 100) / 100,
    count: e.count,
    last_at: e.last_at,
  }));

  return NextResponse.json(out, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
