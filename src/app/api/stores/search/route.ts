import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/stores/search?q=tzaneen
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json([], { headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('stores')
    .select('id,name,code,address,town,area')
    .or(`name.ilike.%${q}%,code.ilike.%${q}%,town.ilike.%${q}%`)
    .order('name')
    .limit(10);

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
