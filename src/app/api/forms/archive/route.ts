import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/forms/archive
// Body: { form_id }
// Auth: x-admin-secret header
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.FORM_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { form_id } = body as { form_id?: string };

  if (!form_id || typeof form_id !== 'string') {
    return NextResponse.json({ error: '`form_id` is required' }, { status: 400 });
  }

  const db = createServerClient();

  const { error } = await db
    .from('form_schemas')
    .update({ is_archived: true })
    .eq('id', form_id);

  if (error) {
    console.error('[archive form]', error);
    return NextResponse.json({ error: 'Failed to archive form' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
