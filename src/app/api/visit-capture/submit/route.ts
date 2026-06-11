import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import type { StoreVisitCapture } from '@/lib/supabase/types';

// POST /api/visit-capture/submit
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  if (!body.report_ref || !body.store_name || !body.visit_date || !body.merchandiser) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('store_visit_captures')
    .insert(body as unknown as Omit<StoreVisitCapture, 'id' | 'submitted_at'>)
    .select('id,submitted_at')
    .single();

  if (error || !data) {
    console.error('[visit-capture/submit]', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  // Mark the booking as completed
  await db
    .from('store_visit_bookings')
    .update({ booking_status: 'Completed' })
    .eq('report_ref', body.report_ref as string)
    .eq('booking_status', 'Logged');

  const rec = data as { id: string; submitted_at: string };
  return NextResponse.json({ capture_id: rec.id, submitted_at: rec.submitted_at }, { status: 201, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}
