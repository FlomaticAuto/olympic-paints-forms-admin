import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

const COLS = 'id,code,name,local_price,long_price,category,sort';

// GET /api/resin-leads/products — active catalogue for the product dropdown.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();
  const { data, error } = await db
    .from('resin_products')
    .select(COLS)
    .eq('is_active', true)
    .order('sort')
    .order('name');

  if (error) {
    console.error('[resin-leads/products GET]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }
  return NextResponse.json(data ?? [], { headers: corsHeaders(origin) });
}

// POST /api/resin-leads/products — add a product to the catalogue.
// Body: { name, code?, local_price?, long_price?, category? }
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) }); }

  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Product name is required' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  // Idempotent by lower(name): return the existing row if it already exists.
  const { data: existing } = await db.from('resin_products').select(COLS).ilike('name', name).maybeSingle();
  if (existing) {
    return NextResponse.json(existing, { headers: corsHeaders(origin) });
  }

  const row = {
    name,
    code:        str(body.code),
    local_price: num(body.local_price),
    long_price:  num(body.long_price),
    category:    str(body.category) || 'Other',
    sort:        500,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).from('resin_products').insert(row).select(COLS).single();
  if (error || !data) {
    // race: someone inserted the same name — return it
    const { data: again } = await db.from('resin_products').select(COLS).ilike('name', name).maybeSingle();
    if (again) return NextResponse.json(again, { headers: corsHeaders(origin) });
    console.error('[resin-leads/products POST]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }
  return NextResponse.json(data, { status: 201, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  });
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
