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
}

// ── Area classification ──────────────────────────────────────────────────────

type AreaKey = 'competitive' | 'account' | 'merchandising' | 'operations' | 'pulse' | 'other';

const AREAS: { key: AreaKey; label: string; icon: string; description: string }[] = [
  { key: 'competitive',   label: 'Competitive Intelligence', icon: '🎯', description: 'Olympic vs competitor matchup verifications' },
  { key: 'account',       label: 'Account Intel',            icon: '🏪', description: 'Per-account competitor intelligence forms' },
  { key: 'merchandising', label: 'Merchandising',            icon: '🖼️', description: 'Store visit and merchandising records' },
  { key: 'operations',    label: 'Operations',               icon: '⚙️', description: 'Returns, H&S, and factory floor forms' },
  { key: 'pulse',         label: 'PULSE / Planning',         icon: '📅', description: 'Weekly cycle plans and rep declarations' },
  { key: 'other',         label: 'Other',                    icon: '📋', description: 'Miscellaneous and test forms' },
];

function classifyForm(title: string): AreaKey {
  const t = title.toLowerCase();
  if (t.startsWith('olympic vs ') || t.includes('matchup verification')) return 'competitive';
  if (t.startsWith('account intel')) return 'account';
  if (t.startsWith('merchandising')) return 'merchandising';
  if (t.startsWith('returns intake') || t.startsWith('h&s') || t.startsWith('h & s')) return 'operations';
  if (t.startsWith('pulse')) return 'pulse';
  return 'other';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function FormRow({
  form,
  countMap,
  onPreview,
}: {
  form: FormSchema;
  countMap: Record<string, number>;
  onPreview: (f: FormSchema) => void;
}) {
  return (
    <tr>
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
      <td>{expiryBadge(form.active_until)}</td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>
        {countMap[form.id] ?? 0}
      </td>
      <td>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            onClick={() => onPreview(form)}
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
          <CopyLinkButton formId={form.id} />
          <ArchiveButton formId={form.id} />
        </div>
      </td>
    </tr>
  );
}

function AreaSection({
  areaKey,
  label,
  icon,
  description,
  forms,
  countMap,
  onPreview,
}: {
  areaKey: AreaKey;
  label: string;
  icon: string;
  description: string;
  forms: FormSchema[];
  countMap: Record<string, number>;
  onPreview: (f: FormSchema) => void;
}) {
  const [open, setOpen] = useState(false);
  const totalSubmissions = forms.reduce((sum, f) => sum + (countMap[f.id] ?? 0), 0);

  return (
    <div style={{
      border: '1px solid var(--color-border-default)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      marginBottom: '12px',
    }}>
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          background: open ? 'var(--color-surface-elevated)' : 'var(--color-surface-base)',
          border: 'none',
          borderBottom: open ? '1px solid var(--color-border-subtle)' : 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 0.15s',
        }}
      >
        {/* Chevron */}
        <span style={{
          fontSize: '11px',
          color: 'var(--color-text-tertiary)',
          transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block',
          flexShrink: 0,
        }}>▶</span>

        {/* Icon + label */}
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-primary)',
          }}>
            {label}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '1px' }}>
            {description}
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{
            background: 'var(--color-brand-primary)',
            color: 'var(--color-text-on-brand)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '12px',
            padding: '2px 9px',
            borderRadius: 'var(--r-pill)',
          }}>
            {forms.length} form{forms.length !== 1 ? 's' : ''}
          </span>
          {totalSubmissions > 0 && (
            <span style={{
              background: 'var(--color-surface-sunken)',
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              border: '1px solid var(--color-border-subtle)',
            }}>
              {totalSubmissions} submission{totalSubmissions !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Form title</th>
                <th>Active from</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Submissions</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map(form => (
                <FormRow
                  key={form.id}
                  form={form}
                  countMap={countMap}
                  onPreview={onPreview}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function FormsTable({ forms, countMap }: Props) {
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

  // Group forms by area
  const grouped: Record<AreaKey, FormSchema[]> = {
    competitive: [], account: [], merchandising: [], operations: [], pulse: [], other: [],
  };
  for (const form of forms) {
    grouped[classifyForm(form.title)].push(form);
  }

  // Only render areas that have forms
  const activeAreas = AREAS.filter(a => grouped[a.key].length > 0);

  return (
    <>
      {activeAreas.map(area => (
        <AreaSection
          key={area.key}
          areaKey={area.key}
          label={area.label}
          icon={area.icon}
          description={area.description}
          forms={grouped[area.key]}
          countMap={countMap}
          onPreview={setPreview}
        />
      ))}

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
