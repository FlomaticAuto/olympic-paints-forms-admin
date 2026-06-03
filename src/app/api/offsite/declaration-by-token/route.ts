import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/offsite/declaration-by-token?token=<uuid>
// Public — the approval page fetches declaration details using the token.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('haven_offsite_declarations')
    .select(
      'id, employee_name, employee_id, department, employer, activity_type, ' +
      'date_from, date_to, departure_time, return_expected, location, purpose, ' +
      'status, submitted_at'
    )
    .eq('approval_token', token)
    .maybeSingle();

  if (error) {
    console.error('[offsite/declaration-by-token]', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ declaration: null }, { status: 200 });
  }

  return NextResponse.json({ declaration: data });
}
