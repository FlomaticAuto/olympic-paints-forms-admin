import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { corsHeaders } from '@/lib/cors';
import type { FormSchema, FormSubmission } from '@/lib/supabase/types';

export async function OPTIONS(req: NextRequest) {
  const cors = { ...corsHeaders(req.headers.get('origin')), 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  return new NextResponse(null, { status: 204, headers: cors });
}

// POST /api/submit/[form_id]
// PUBLIC endpoint — no admin auth.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ form_id: string }> }
) {
  const origin = req.headers.get('origin');
  const { form_id } = await params;
  if (!form_id) {
    return NextResponse.json({ error: 'Missing form_id' }, { status: 400, headers: corsHeaders(origin) });
  }

  let body: { data?: Record<string, unknown>; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders(origin) });
  }

  const data = body.data;
  const metadata = body.metadata ?? {};
  const repCode = typeof metadata.rep_code === 'string' ? metadata.rep_code.trim() : '';

  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: '`data` object required' }, { status: 400, headers: corsHeaders(origin) });
  }
  if (!repCode) {
    return NextResponse.json({ error: '`metadata.rep_code` required' }, { status: 400, headers: corsHeaders(origin) });
  }

  const db = createServerClient();

  const { data: rawForm, error: formError } = await db
    .from('form_schemas')
    .select('id,is_archived,active_from,active_until')
    .eq('id', form_id)
    .maybeSingle();
  const form = rawForm as Pick<FormSchema, 'id' | 'is_archived' | 'active_from' | 'active_until'> | null;

  if (formError || !form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders(origin) });
  }
  if (form.is_archived) {
    return NextResponse.json({ error: 'Form archived' }, { status: 410, headers: corsHeaders(origin) });
  }
  const now = new Date();
  if (form.active_until && new Date(form.active_until) < now) {
    return NextResponse.json({ error: 'Form closed' }, { status: 410, headers: corsHeaders(origin) });
  }
  if (form.active_from && new Date(form.active_from) > now) {
    return NextResponse.json({ error: 'Form not yet active' }, { status: 403, headers: corsHeaders(origin) });
  }

  const { data: rawExisting, error: existsError } = await db
    .from('form_submissions')
    .select('id')
    .eq('form_id', form_id)
    .filter('metadata->>rep_code', 'eq', repCode)
    .limit(1);
  const existing = (rawExisting ?? []) as { id: string }[];

  if (existsError) {
    console.error('[submit — lockout check]', existsError);
    return NextResponse.json({ error: 'Submission check failed' }, { status: 500, headers: corsHeaders(origin) });
  }
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Already submitted', code: 'DUPLICATE' }, { status: 409, headers: corsHeaders(origin) });
  }

  const submittedBy = typeof metadata.rep_email === 'string' ? metadata.rep_email : null;
  const insertRow: Omit<FormSubmission, 'id' | 'submitted_at'> = {
    form_id,
    submitted_by: submittedBy,
    data,
    metadata,
  };

  const { data: rawIns, error: insError } = await db
    .from('form_submissions')
    .insert(insertRow as never)
    .select('id,submitted_at')
    .single();

  if (insError || !rawIns) {
    console.error('[submit — insert]', insError);
    return NextResponse.json({ error: 'Save failed' }, { status: 500, headers: corsHeaders(origin) });
  }

  const ins = rawIns as { id: string; submitted_at: string };

  // Mark respondent as submitted in form_respondents (if email is present in metadata).
  const respondentEmail = typeof metadata.respondent_email === 'string'
    ? metadata.respondent_email.toLowerCase().trim()
    : null;

  if (respondentEmail) {
    const { error: rErr } = await db
      .from('form_respondents')
      .update({ submitted_at: ins.submitted_at } as never)
      .eq('form_id', form_id)
      .eq('email', respondentEmail);
    if (rErr) {
      console.error('[submit — respondent upsert]', rErr);
      // Non-fatal: submission was saved; log and continue.
    }
  }

  return NextResponse.json({ submission_id: ins.id, submitted_at: ins.submitted_at }, { status: 201, headers: corsHeaders(origin) });
}
