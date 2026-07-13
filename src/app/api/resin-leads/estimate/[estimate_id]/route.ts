import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

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

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
