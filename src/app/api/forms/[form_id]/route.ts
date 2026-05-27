import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { FormField } from '@/lib/supabase/types';

// PATCH /api/forms/[form_id]
// Body: { schema: FormField[] }  — replaces the stored schema in-place.
// Keeps the same form ID so existing links stay valid.
// Auth: x-admin-secret header
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.FORM_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { form_id } = await params;
  if (!form_id) {
    return NextResponse.json({ error: 'Missing form_id' }, { status: 400 });
  }

  let body: { schema?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.schema) || body.schema.length === 0) {
    return NextResponse.json({ error: '`schema` must be a non-empty array' }, { status: 400 });
  }

  const db = createServerClient();

  const { error } = await db
    .from('form_schemas')
    .update({ schema: body.schema as FormField[] })
    .eq('id', form_id);

  if (error) {
    console.error('[patch form schema]', error);
    return NextResponse.json({ error: 'Failed to update schema' }, { status: 500 });
  }

  return NextResponse.json({ form_id, updated: true });
}
