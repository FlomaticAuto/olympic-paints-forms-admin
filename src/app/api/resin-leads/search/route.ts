import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

const LEAD_COLS =
  'id,lead_ref,company,contact_person,phone,mobile,email,lead_source,lead_status,distance,street,city,province,postal_code,rep,notes';

// GET /api/resin-leads/search?q=acme
// Returns full lead rows so the visit form can auto-populate on select.
export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json([], { headers: corsHeaders(origin) });
  }

  const db = createServerClient();
  const like = `%${q}%`;

  const { data, error } = await db
    .from('resin_leads')
    .select(LEAD_COLS)
    .or(
      `company.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},` +
      `mobile.ilike.${like},email.ilike.${like},lead_ref.ilike.${like},city.ilike.${like}`
    )
    .order('company')
    .limit(20);

  if (error) {
    console.error('[resin-leads/search]', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  return NextResponse.json(data ?? [], { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'GET, OPTIONS' },
  });
}
