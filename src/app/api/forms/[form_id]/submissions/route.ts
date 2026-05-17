import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { FormSchema, FormSubmission, FormRespondent } from '@/lib/supabase/types';

// GET /api/forms/[form_id]/submissions
// Returns all submissions for the given form, newest first.
// With ?respondents=true: returns { submitted: string[] } from form_respondents (for the poller).
// Auth: x-admin-secret header
export async function GET(
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

  const db = createServerClient();

  // Verify form exists.
  const { data: rawForm, error: formError } = await db
    .from('form_schemas')
    .select('*')
    .eq('id', form_id)
    .maybeSingle();
  const form = rawForm as FormSchema | null;

  if (formError) {
    console.error('[submissions — form lookup]', formError);
    return NextResponse.json({ error: 'Failed to verify form' }, { status: 500 });
  }
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  // ?respondents=true — poller mode: return submitted email list from form_respondents.
  const respondentsMode = req.nextUrl.searchParams.get('respondents') === 'true';
  if (respondentsMode) {
    const { data: rawR, error: rErr } = await db
      .from('form_respondents')
      .select('email')
      .eq('form_id', form_id)
      .not('submitted_at', 'is', null);
    const rows = (rawR ?? []) as Pick<FormRespondent, 'email'>[];

    if (rErr) {
      console.error('[submissions — respondents fetch]', rErr);
      return NextResponse.json({ error: 'Failed to fetch respondents' }, { status: 500 });
    }

    return NextResponse.json({ submitted: rows.map((r) => r.email) });
  }

  // Default mode: return full submissions list.
  const { data: rawSubs, error: subError } = await db
    .from('form_submissions')
    .select('*')
    .eq('form_id', form_id)
    .order('submitted_at', { ascending: false });
  const submissions = (rawSubs ?? []) as FormSubmission[];

  if (subError) {
    console.error('[submissions — fetch]', subError);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }

  return NextResponse.json({
    form_id,
    form_title: form.title,
    submissions,
  });
}
