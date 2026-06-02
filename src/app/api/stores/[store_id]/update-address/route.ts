import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';

// POST /api/stores/[store_id]/update-address
// Called silently after a form submission when the user entered a manual address.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store_id: string }> }
) {
  const origin = req.headers.get('origin');
  const { store_id } = await params;

  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  const parts = address.split(',').map((p: string) => p.trim()).filter(Boolean);
  const town = parts.length > 1 ? parts[parts.length - 1] : null;
  const street = parts.length > 1 ? parts.slice(0, -1).join(', ') : address;

  const { error } = await db
    .from('stores')
    .update({ address: street, town } as never)
    .eq('id', store_id);

  if (error) {
    console.error('[stores/update-address]', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}
