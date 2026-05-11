import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/forms/[form_id]/submissions
// Returns all submissions for the given form, newest first.
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

  // Verify the form exists (archived or not — admins can still read submissions)
  const { data: form, error: formError } = await db
    .from('form_schemas')
    .select('id, title')
    .eq('id', form_id)
    .maybeSingle();

  if (formError) {
    console.error('[submissions — form lookup]', formError);
    return NextResponse.json({ error: 'Failed to verify form' }, { status: 500 });
  }

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  const { data: submissions, error: subError } = await db
    .from('form_submissions')
    .select('id, form_id, submitted_by, data, submitted_at, metadata')
    .eq('form_id', form_id)
    .order('submitted_at', { ascending: false });

  if (subError) {
    console.error('[submissions — fetch]', subError);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }

  return NextResponse.json({
    form_id,
    form_title: form.title,
    submissions: submissions ?? [],
  });
}
