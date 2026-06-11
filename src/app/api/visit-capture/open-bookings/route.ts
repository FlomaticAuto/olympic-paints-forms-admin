import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// GET /api/visit-capture/open-bookings
// Returns all Logged bookings so the form can show a dropdown
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('store_visit_bookings')
    .select('report_ref,store_name,store_address,visit_date,purpose,tasks,merchandiser,booked_by')
    .eq('booking_status', 'Logged')
    .order('visit_date', { ascending: true });

  if (error) {
    console.error('[open-bookings]', error);
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500, headers: corsHeaders(origin) });
  }

  return NextResponse.json({ bookings: data ?? [] }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
}
