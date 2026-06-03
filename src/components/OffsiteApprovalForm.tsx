'use client';
import { useState, useEffect } from 'react';

interface Declaration {
  id: string;
  employee_name: string;
  employee_id: string;
  department: string;
  employer: string;
  activity_type: string;
  date_from: string;
  date_to: string;
  departure_time: string | null;
  return_expected: string | null;
  location: string;
  purpose: string;
  status: string;
  submitted_at: string;
}

type View = 'loading' | 'invalid' | 'already_decided' | 'form' | 'done';

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(t: string | null) {
  if (!t) return '—';
  return t.slice(0, 5);
}

export default function OffsiteApprovalForm({ token }: { token: string }) {
  const [view, setView]       = useState<View>('loading');
  const [decl, setDecl]       = useState<Declaration | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | ''>('');
  const [notes, setNotes]     = useState('');
  const [approverName, setApproverName] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [finalDecision, setFinalDecision] = useState('');

  useEffect(() => {
    fetch(`/api/offsite/declaration-by-token?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.declaration) { setView('invalid'); return; }
        setDecl(d.declaration);
        if (d.declaration.status !== 'pending') {
          setFinalDecision(d.declaration.status);
          setView('already_decided');
        } else {
          setView('form');
        }
      })
      .catch(() => setView('invalid'));
  }, [token]);

  async function onSubmit() {
    if (!decision || !approverName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/offsite/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, decision, approver_name: approverName, notes }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Failed');
      setFinalDecision(decision);
      setView('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (view === 'loading') {
    return (
      <div style={styles.centred}>
        <div style={styles.spinner} />
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 16 }}>Loading declaration…</p>
      </div>
    );
  }

  if (view === 'invalid') {
    return (
      <div style={styles.centred}>
        <div style={{ ...styles.badge, background: 'var(--color-danger-bg)', color: 'var(--color-danger-fg)', border: '1px solid var(--color-danger-bd)' }}>
          Link Invalid
        </div>
        <p style={styles.subText}>This approval link is not valid or has expired.</p>
      </div>
    );
  }

  if (view === 'already_decided') {
    const isApproved = finalDecision === 'approved';
    return (
      <div style={styles.centred}>
        <div style={{
          ...styles.badge,
          background: isApproved ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: isApproved ? 'var(--color-success-fg)' : 'var(--color-danger-fg)',
          border: `1px solid ${isApproved ? 'var(--color-success-bd)' : 'var(--color-danger-bd)'}`,
        }}>
          Already {finalDecision === 'approved' ? 'Approved' : 'Rejected'}
        </div>
        <p style={styles.subText}>This declaration has already been reviewed.</p>
        {decl && <DeclarationSummary decl={decl} />}
      </div>
    );
  }

  if (view === 'done') {
    const isApproved = finalDecision === 'approved';
    return (
      <div style={styles.centred}>
        <div style={{
          ...styles.bigIcon,
          background: isApproved ? 'var(--color-brand-primary)' : 'var(--color-danger-bg)',
          color: isApproved ? 'var(--color-text-on-brand)' : 'var(--color-danger-fg)',
        }}>
          {isApproved ? '✓' : '✕'}
        </div>
        <h2 style={styles.doneTitle}>
          Declaration {isApproved ? 'Approved' : 'Rejected'}
        </h2>
        <p style={styles.subText}>
          {isApproved
            ? `${decl?.employee_name} has been notified. This activity will appear as approved in the clocking dashboard.`
            : `${decl?.employee_name} has been notified that this declaration was not approved.`}
        </p>
      </div>
    );
  }

  // view === 'form'
  return (
    <div style={{ maxWidth: 560, margin: '32px auto', padding: '0 20px' }}>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
        Review the off-site declaration below and approve or reject it.
        The employee will be notified of your decision via WhatsApp.
      </p>

      {decl && <DeclarationSummary decl={decl} />}

      <div style={styles.decisionCard}>
        <h3 style={styles.sectionTitle}>Your Decision</h3>

        <div style={styles.field}>
          <label style={styles.label}>Your Name *</label>
          <input
            type="text"
            style={styles.input}
            value={approverName}
            onChange={e => setApproverName(e.target.value)}
            placeholder="Type your name to confirm"
          />
        </div>

        <div style={styles.chipGroup}>
          <button
            type="button"
            style={{ ...styles.chip, ...(decision === 'approved' ? styles.chipApprove : {}) }}
            onClick={() => setDecision('approved')}
          >
            ✓ Approve
          </button>
          <button
            type="button"
            style={{ ...styles.chip, ...(decision === 'rejected' ? styles.chipReject : {}) }}
            onClick={() => setDecision('rejected')}
          >
            ✕ Reject
          </button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Notes (optional)</label>
          <textarea
            style={{ ...styles.input, height: 72, resize: 'vertical' }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any comments for the employee…"
          />
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <button
          onClick={onSubmit}
          disabled={!decision || !approverName.trim() || busy}
          style={{
            ...styles.submitBtn,
            ...(decision === 'rejected' ? styles.submitBtnReject : {}),
            ...((!decision || !approverName.trim() || busy) ? styles.btnDisabled : {}),
          }}
        >
          {busy ? 'Submitting…' : decision === 'rejected' ? 'Reject Declaration' : 'Approve Declaration'}
        </button>
      </div>
    </div>
  );
}

function DeclarationSummary({ decl }: { decl: Declaration }) {
  const isOvernight = decl.activity_type === 'Overnight Stay';
  const multiDay = decl.date_from !== decl.date_to;
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryHeader}>
        <div>
          <div style={styles.summaryName}>{decl.employee_name}</div>
          <div style={styles.summaryMeta}>{decl.employee_id} · {decl.department} · {decl.employer}</div>
        </div>
        <div style={styles.activityBadge}>{decl.activity_type}</div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryRow label="Date" value={multiDay ? `${formatDate(decl.date_from)} → ${formatDate(decl.date_to)}` : formatDate(decl.date_from)} />
        {!isOvernight && (
          <>
            <SummaryRow label="Departure" value={formatTime(decl.departure_time)} />
            <SummaryRow label="Expected Return" value={formatTime(decl.return_expected)} />
          </>
        )}
        <SummaryRow label="Location" value={decl.location} />
        <SummaryRow label="Purpose" value={decl.purpose} />
        <SummaryRow label="Submitted" value={new Date(decl.submitted_at).toLocaleString('en-ZA')} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.summaryRow}>
      <span style={styles.summaryLabel}>{label}</span>
      <span style={styles.summaryValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centred: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: '60vh',
    justifyContent: 'center',
    padding: 24,
    textAlign: 'center',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--color-border-default)',
    borderTop: '3px solid var(--color-brand-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  badge: {
    borderRadius: 'var(--r-pill)',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '8px 20px',
    textTransform: 'uppercase',
  },
  bigIcon: {
    alignItems: 'center',
    borderRadius: '50%',
    display: 'flex',
    fontSize: 30,
    fontWeight: 700,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  doneTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--color-text-primary)',
  },
  subText: {
    color: 'var(--color-text-secondary)',
    fontSize: 14,
    maxWidth: 380,
    lineHeight: 1.6,
  },
  summaryCard: {
    background: 'var(--color-surface-base)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-lg)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  summaryHeader: {
    alignItems: 'flex-start',
    background: 'var(--color-surface-elevated)',
    borderBottom: '1px solid var(--color-border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 20px',
  },
  summaryName: {
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--color-text-primary)',
  },
  summaryMeta: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginTop: 2,
  },
  activityBadge: {
    background: 'var(--color-warning-bg)',
    border: '1px solid var(--color-warning-bd)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--color-warning-fg)',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    whiteSpace: 'nowrap',
  },
  summaryGrid: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 20px',
  },
  summaryRow: {
    borderBottom: '1px solid var(--color-border-subtle)',
    display: 'flex',
    gap: 12,
    padding: '10px 0',
  },
  summaryLabel: {
    color: 'var(--color-text-secondary)',
    fontSize: 12,
    fontWeight: 500,
    minWidth: 120,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  summaryValue: {
    color: 'var(--color-text-primary)',
    fontSize: 14,
  },
  decisionCard: {
    background: 'var(--color-surface-base)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '20px 24px',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--color-text-secondary)',
  },
  input: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    padding: '10px 14px',
    width: '100%',
    outline: 'none',
  },
  chipGroup: { display: 'flex', gap: 12 },
  chip: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    flex: 1,
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '12px 0',
    textTransform: 'uppercase',
    transition: 'all 0.15s',
  },
  chipApprove: {
    background: 'var(--color-success-bg)',
    border: '2px solid var(--color-success-bd)',
    color: 'var(--color-success-fg)',
  },
  chipReject: {
    background: 'var(--color-danger-bg)',
    border: '2px solid var(--color-danger-bd)',
    color: 'var(--color-danger-fg)',
  },
  submitBtn: {
    background: 'var(--color-brand-primary)',
    border: 'none',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-on-brand)',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '14px 28px',
    textTransform: 'uppercase',
    width: '100%',
    transition: 'background 0.15s',
  },
  submitBtnReject: {
    background: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-bd)',
    color: 'var(--color-danger-fg)',
  },
  btnDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  errorBanner: {
    background: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-bd)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-danger-fg)',
    fontSize: 14,
    padding: '12px 16px',
  },
};
