import { createServerClient } from '@/lib/supabase/server';
import AdminShell from '@/components/AdminShell';
import FormsTable from '@/components/FormsTable';

export const dynamic = 'force-dynamic';

// Server Component — fetches directly with service_role client.
// No API round-trip needed; middleware already guards this route.
export default async function AdminFormsPage() {
  const db = createServerClient();

  // select('*') avoids Supabase's jsonb→never generic narrowing on column-list selects.
  const { data: rawForms, error } = await db
    .from('form_schemas')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  const forms = (rawForms ?? []) as import('@/lib/supabase/types').FormSchema[];

  // Submission counts — one query, tallied in JS
  const formIds = forms.map(f => f.id);
  const { data: countRows } = formIds.length
    ? await db.from('form_submissions').select('form_id').in('form_id', formIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of (countRows ?? []) as Array<{ form_id: string }>) {
    countMap[row.form_id] = (countMap[row.form_id] ?? 0) + 1;
  }

  const baseUrl = process.env.NEXT_PUBLIC_GITHUB_PAGES_BASE_URL ?? '';

  return (
    <AdminShell>
      <div className="page-heading">
        <h1>Forms</h1>
        <p>Forms grouped by area. Click a section to expand, then click a title to view submissions.</p>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          marginBottom: '20px',
          background: 'var(--color-danger-bg)',
          border: '1px solid var(--color-danger-bd)',
          borderRadius: 'var(--r-md)',
          color: 'var(--color-danger-fg)',
          fontSize: '13px',
        }}>
          Failed to load forms: {error.message}
        </div>
      )}

      <FormsTable forms={forms} countMap={countMap} baseUrl={baseUrl} />
    </AdminShell>
  );
}
