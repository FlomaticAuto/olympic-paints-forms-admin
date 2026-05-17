import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/forms/create
// Body: { title, description?, schema, active_from?, active_until?, created_by?, respondents? }
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

  const { title, description, schema, active_from, active_until, created_by, respondents } = body as {
    title?: string;
    description?: string;
    schema?: unknown[];
    active_from?: string;
    active_until?: string;
    created_by?: string;
    respondents?: string[];
  };

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json({ error: '`title` is required' }, { status: 400 });
  }
  if (!Array.isArray(schema) || schema.length === 0) {
    return NextResponse.json({ error: '`schema` must be a non-empty array of field objects' }, { status: 400 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('form_schemas')
    .insert({
      title:        title.trim(),
      description:  description ?? null,
      schema:       schema,
      active_from:  active_from ?? new Date().toISOString(),
      active_until: active_until ?? null,
      created_by:   created_by ?? null,
      is_archived:  false,
    } as never)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[create form]', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }

  const created = data as { id: string };

  // Insert one form_respondents row per email (if provided).
  if (Array.isArray(respondents) && respondents.length > 0) {
    const rows = respondents
      .filter((e) => typeof e === 'string' && e.includes('@'))
      .map((email) => ({ form_id: created.id, email: email.toLowerCase().trim(), submitted_at: null }));

    if (rows.length > 0) {
      const { error: rErr } = await db.from('form_respondents').insert(rows as never);
      if (rErr) {
        console.error('[create form — respondents insert]', rErr);
        // Non-fatal: form was created; log the error but still return success.
      }
    }
  }

  const formUrl = `https://olympic-paints-forms-admin.vercel.app/f/${created.id}`;

  return NextResponse.json({ form_id: created.id, form_url: formUrl }, { status: 201 });
}
