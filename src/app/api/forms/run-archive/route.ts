import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/forms/run-archive
// Manually triggers the archive_expired_forms() Supabase RPC.
// Use this on the free tier (no pg_cron) or as an on-demand trigger.
// Auth: x-admin-secret header
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!secret || secret !== process.env.FORM_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  // Count currently expired-but-active forms before archiving
  const { count: before } = await db
    .from('form_schemas')
    .select('id', { count: 'exact', head: true })
    .eq('is_archived', false)
    .lt('active_until', new Date().toISOString());

  const { error } = await db.rpc('archive_expired_forms');

  if (error) {
    console.error('[run-archive]', error);
    return NextResponse.json({ error: 'archive_expired_forms() failed' }, { status: 500 });
  }

  return NextResponse.json({ archived_count: before ?? 0 });
}
