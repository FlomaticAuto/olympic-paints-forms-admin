import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/forms/list
// Returns all non-archived forms with submission count per form.
// Auth: x-admin-secret header
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.FORM_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  // Fetch all non-archived forms
  const { data: forms, error: formsError } = await db
    .from('form_schemas')
    .select('id, title, description, created_by, active_from, active_until, is_archived, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (formsError) {
    console.error('[list forms]', formsError);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }

  if (!forms || forms.length === 0) {
    return NextResponse.json({ forms: [] });
  }

  // Fetch submission counts for all returned form IDs in one query
  const formIds = forms.map(f => f.id);

  const { data: counts, error: countsError } = await db
    .from('form_submissions')
    .select('form_id')
    .in('form_id', formIds);

  if (countsError) {
    console.error('[list forms — counts]', countsError);
    // Non-fatal: return forms without counts rather than failing
  }

  // Tally counts per form_id
  const countMap: Record<string, number> = {};
  for (const row of counts ?? []) {
    countMap[row.form_id] = (countMap[row.form_id] ?? 0) + 1;
  }

  const baseUrl = process.env.NEXT_PUBLIC_GITHUB_PAGES_BASE_URL ?? '';

  const result = forms.map(f => ({
    ...f,
    submission_count: countMap[f.id] ?? 0,
    public_url: `${baseUrl}?id=${f.id}`,
  }));

  return NextResponse.json({ forms: result });
}
