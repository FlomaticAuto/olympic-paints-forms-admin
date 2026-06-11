import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/visit-capture/lookup?ref=SVB-260603-1234
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const ref = req.nextUrl.searchParams.get('ref')?.trim().toUpperCase() ?? '';

  if (!ref) {
    return NextResponse.json({ error: 'Missing ref' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('store_visit_bookings')
    .select('report_ref,store_name,store_address,visit_date,purpose,tasks,merchandiser')
    .eq('report_ref', ref)
    .maybeSingle();

  if (error) {
    console.error('[visit-capture/lookup]', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500, headers: corsHeaders(origin) });
  }
  if (!data) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404, headers: corsHeaders(origin) });
  }

  const booking = {
    store_name:    data.store_name,
    store_address: data.store_address ?? null,
    visit_date:    data.visit_date,
    purpose:       data.purpose ?? '',
    tasks:         Array.isArray(data.tasks) ? data.tasks : [],
    merchandiser:  data.merchandiser,
  };

  return NextResponse.json({ booking }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
