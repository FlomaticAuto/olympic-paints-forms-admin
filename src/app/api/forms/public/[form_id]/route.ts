import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import type { FormSchema } from '@/lib/supabase/types';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

// GET /api/forms/public/[form_id]
// PUBLIC endpoint — returns schema only (no submissions, no admin data).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  const origin = req.headers.get('origin');
  const { form_id } = await params;
  if (!form_id) {
    return NextResponse.json({ error: 'Missing form_id' }, { status: 400, headers: corsHeaders(origin) });
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
    return NextResponse.json({ error: 'Failed to load form' }, { status: 500, headers: corsHeaders(origin) });
  }
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders(origin) });
  }
  if (form.is_archived) {
    return NextResponse.json({ error: 'Form archived' }, { status: 410, headers: corsHeaders(origin) });
  }
  const now = new Date();
  if (form.active_from && new Date(form.active_from) > now) {
    return NextResponse.json({ error: 'Form not yet active' }, { status: 403, headers: corsHeaders(origin) });
  }
  if (form.active_until && new Date(form.active_until) < now) {
    return NextResponse.json({ error: 'Form closed' }, { status: 410, headers: corsHeaders(origin) });
  }

  return NextResponse.json({
    id:          form.id,
    title:       form.title,
    description: form.description,
    schema:      form.schema,
  }, { headers: corsHeaders(origin) });
}
