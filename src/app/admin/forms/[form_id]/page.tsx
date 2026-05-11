import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import ExportCsvButton from '@/components/ExportCsvButton';
import type { FormSubmission } from '@/lib/supabase/types';
import Link from 'next/link';

interface Props {
  params: Promise<{ form_id: string }>;
}

export default async function SubmissionsPage({ params }: Props) {
  const { form_id } = await params;
  const db = createServerClient();

  // Load form metadata
  const { data: form, error: formError } = await db
    .from('form_schemas')
    .select('id, title, description, schema, active_from, active_until, created_by, created_at')
    .eq('id', form_id)
    .maybeSingle();

  if (formError || !form) notFound();

  // Load submissions
  const { data: submissions, error: subError } = await db
    .from('form_submissions')
    .select('id, form_id, submitted_by, data, submitted_at, metadata')
    .eq('form_id', form_id)
    .order('submitted_at', { ascending: false });

  // Derive column headers from schema field labels (ordered)
  const fields = [...(form.schema ?? [])].sort(
    (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0)
  ) as Array<{ id: string; label: string; type: string }>;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function fmtVal(val: unknown): string {
    if (val == null) return '—';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }

  return (
    <AdminShell>
      <Link href="/admin/forms" className="back-link">
        ← All forms
      </Link>

      <div className="page-heading">
        <h1>{form.title}</h1>
        {form.description && <p>{form.description}</p>}
      </div>

      {/* Meta row */}
      <div className="meta-row">
        <div>
          <div className="meta-item-label">Form ID</div>
          <div className="meta-item-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {form.id}
          </div>
        </div>
        <div>
          <div className="meta-item-label">Active from</div>
          <div className="meta-item-value">{fmtDate(form.active_from)}</div>
        </div>
        <div>
          <div className="meta-item-label">Active until</div>
          <div className="meta-item-value">
            {form.active_until ? fmtDate(form.active_until) : 'No expiry'}
          </div>
        </div>
        <div>
          <div className="meta-item-label">Created by</div>
          <div className="meta-item-value">{form.created_by ?? '—'}</div>
        </div>
        <div>
          <div className="meta-item-label">Submissions</div>
          <div className="meta-item-value" style={{ fontWeight: 700, color: 'var(--color-brand-primary)' }}>
            {submissions?.length ?? 0}
          </div>
        </div>
      </div>

      {subError && (
        <div style={{
          padding: '14px 18px', marginBottom: '20px',
          background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-bd)',
          borderRadius: 'var(--r-md)', color: 'var(--color-danger-fg)', fontSize: '13px',
        }}>
          Failed to load submissions: {subError.message}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-left">
          {submissions?.length ?? 0} response{(submissions?.length ?? 0) !== 1 ? 's' : ''}
        </div>
        <ExportCsvButton
          submissions={(submissions ?? []) as FormSubmission[]}
          formTitle={form.title}
        />
      </div>

      <div className="card">
        {!submissions || submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No submissions yet</div>
            <div className="empty-state-body">
              Share the public form link and responses will appear here.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Submitted at</th>
                  <th>Submitted by</th>
                  {fields.map(f => (
                    <th key={f.id}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => {
                  const data = sub.data as Record<string, unknown>;
                  return (
                    <tr key={sub.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                        {fmtDate(sub.submitted_at)}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {sub.submitted_by ?? <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                      </td>
                      {fields.map(f => (
                        <td key={f.id}>{fmtVal(data[f.id])}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
