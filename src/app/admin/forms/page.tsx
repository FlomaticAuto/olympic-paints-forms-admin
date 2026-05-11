import { createServerClient } from '@/lib/supabase/server';
import AdminShell from '@/components/AdminShell';
import ArchiveButton from '@/components/ArchiveButton';
import CopyLinkButton from '@/components/CopyLinkButton';
import Link from 'next/link';

// Server Component — fetches directly with service_role client.
// No API round-trip needed; middleware already guards this route.
export default async function AdminFormsPage() {
  const db = createServerClient();

  const { data: forms, error } = await db
    .from('form_schemas')
    .select('id, title, description, created_by, active_from, active_until, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  // Submission counts — one query, tallied in JS
  const formIds = (forms ?? []).map(f => f.id);
  const { data: countRows } = formIds.length
    ? await db.from('form_submissions').select('form_id').in('form_id', formIds)
    : { data: [] };

  const countMap: Record<string, number> = {};
  for (const row of countRows ?? []) {
    countMap[row.form_id] = (countMap[row.form_id] ?? 0) + 1;
  }

  const baseUrl = process.env.NEXT_PUBLIC_GITHUB_PAGES_BASE_URL ?? '';

  function fmtDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  function expiryBadge(activeUntil: string | null) {
    if (!activeUntil) return <span className="badge badge-success">Active</span>;
    const expired = new Date(activeUntil) < new Date();
    return expired
      ? <span className="badge badge-warning">Expired</span>
      : <span className="badge badge-success">Active until {fmtDate(activeUntil)}</span>;
  }

  return (
    <AdminShell>
      <div className="page-heading">
        <h1>Forms</h1>
        <p>All active forms. Click a title to view submissions.</p>
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

      <div className="card">
        {!forms || forms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No forms yet</div>
            <div className="empty-state-body">
              Create your first form using the API or curl. See the README for examples.
            </div>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Form title</th>
                <th>Active from</th>
                <th>Active until</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Submissions</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <tr key={form.id}>
                  <td>
                    <Link
                      href={`/admin/forms/${form.id}`}
                      style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}
                    >
                      {form.title}
                    </Link>
                    {form.description && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                        {form.description}
                      </div>
                    )}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(form.active_from)}
                  </td>
                  <td style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                    {fmtDate(form.active_until)}
                  </td>
                  <td>{expiryBadge(form.active_until)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {countMap[form.id] ?? 0}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <CopyLinkButton url={`${baseUrl}?id=${form.id}`} />
                      <ArchiveButton formId={form.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
