'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { FormSchema } from '@/lib/supabase/types';
import CopyLinkButton from '@/components/CopyLinkButton';
import ArchiveButton from '@/components/ArchiveButton';
import FormPreviewPanel from '@/components/FormPreviewPanel';

interface Props {
  forms: FormSchema[];
  countMap: Record<string, number>;
  baseUrl: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiryBadge(activeUntil: string | null) {
  if (!activeUntil) return <span className="badge badge-success">Active</span>;
  const expired = new Date(activeUntil) < new Date();
  return expired
    ? <span className="badge badge-warning">Expired</span>
    : <span className="badge badge-success">Active until {fmtDate(activeUntil)}</span>;
}

export default function FormsTable({ forms, countMap, baseUrl }: Props) {
  const [preview, setPreview] = useState<FormSchema | null>(null);

  if (!forms || forms.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No forms yet</div>
        <div className="empty-state-body">
          Create your first form using the API or curl. See the README for examples.
        </div>
      </div>
    );
  }

  return (
    <>
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
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <button
                    onClick={() => setPreview(form)}
                    title="Preview form"
                    style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: 'var(--r-sm)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 12,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    👁 Preview
                  </button>
                  <CopyLinkButton url={`${baseUrl}?id=${form.id}`} />
                  <ArchiveButton formId={form.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {preview && (
        <FormPreviewPanel
          title={preview.title}
          description={preview.description}
          schema={preview.schema}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
