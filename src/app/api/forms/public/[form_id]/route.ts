import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { FormSchema } from '@/lib/supabase/types';

// GET /api/forms/public/[form_id]
// PUBLIC endpoint — returns schema only (no submissions, no admin data).
// Only returns the form if it's not archived and within its active window.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  const { form_id } = await params;
  if (!form_id) {
    return NextResponse.json({ error: 'Missing form_id' }, { status: 400 });
  }

  const db = createServerClient();
  const { data: raw, error } = await db
    .from('form_schemas')
    .select('id,title,description,schema,active_from,active_until,is_archived')
    .eq('id', form_id)
    .maybeSingle();
  const form = raw as Partial<FormSchema> | null;

  if (error) {
    console.error('[public form]', error);
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500 });
  }
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }
  if (form.is_archived) {
    return NextResponse.json({ error: 'Form archived' }, { status: 410 });
  }
  const now = new Date();
  if (form.active_from && new Date(form.active_from) > now) {
    return NextResponse.json({ error: 'Form not yet active' }, { status: 403 });
  }
  if (form.active_until && new Date(form.active_until) < now) {
    return NextResponse.json({ error: 'Form closed' }, { status: 410 });
  }

  return NextResponse.json({
    id:          form.id,
    title:       form.title,
    description: form.description,
    schema:      form.schema,
  });
}
