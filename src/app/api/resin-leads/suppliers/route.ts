import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/resin-leads/suppliers — supplier database, for the current-supplier
// combobox suggestions. New suppliers are added on visit submit, not here.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();
  const { data, error } = await db
    .from('resin_suppliers')
    .select('id,name')
    .order('name');

  if (error) {
    console.error('[resin-leads/suppliers GET]', error);
    return NextResponse.json({ error: 'Load failed' }, { status: 500, headers: corsHeaders(origin) });
  }
  return NextResponse.json(data ?? [], { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
