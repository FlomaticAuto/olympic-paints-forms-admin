import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/stores/search?q=tzaneen&rep=AP
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const q   = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const rep = req.nextUrl.searchParams.get('rep')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json([], { headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  let query = db
    .from('stores')
    .select('id,name,code,dlref,curef,address,town,area')
    .or(`name.ilike.%${q}%,dlref.ilike.%${q}%,curef.ilike.%${q}%,code.ilike.%${q}%,town.ilike.%${q}%`);

  if (rep) {
    query = query.eq('rep', rep);
  }

  const { data, error } = await query.order('name').limit(20);

  if (error) {
    console.error('[stores/search]', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  return NextResponse.json(data ?? [], { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const cors = {
    ...corsHeaders(req.headers.get('origin')),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  return new NextResponse(null, { status: 204, headers: cors });
}
