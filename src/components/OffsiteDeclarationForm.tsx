'use client';
import { useState, useEffect, FormEvent } from 'react';

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  employer: string;
}

const ACTIVITY_TYPES = ['Overnight Stay', 'Field Visit', 'Delivery Run', 'Training', 'Other'];
const DEPARTMENTS    = ['Merchandising', 'Sales', 'Delivery', 'Operations', 'HR', 'Admin', 'Primeserve', 'Other'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function OffsiteDeclarationForm() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);

  // Form fields
  const [employeeId,    setEmployeeId]    = useState('');
  const [employeeName,  setEmployeeName]  = useState('');
  const [department,    setDepartment]    = useState('');
  const [activityType,  setActivityType]  = useState('');
  const [dateFrom,      setDateFrom]      = useState(todayStr());
  const [dateTo,        setDateTo]        = useState(todayStr());
  const [departureTime, setDepartureTime] = useState('');
  const [returnExpected,setReturnExpected]= useState('');
  const [location,      setLocation]      = useState('');
  const [purpose,       setPurpose]       = useState('');

  const [busy,  setBusy]  = useState(false);
  const [done,  setDone]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOvernight = activityType === 'Overnight Stay';

  useEffect(() => {
    fetch('/api/offsite/employees')
      .then(r => r.json())
      .then((d: { employees: Employee[] }) => { setEmployees(d.employees ?? []); setLoadingEmp(false); })
      .catch(() => setLoadingEmp(false));
  }, []);

  function handleEmployeeChange(id: string) {
    setEmployeeId(id);
    const emp = employees.find(e => e.id === id);
    if (emp) {
      setEmployeeName(emp.full_name);
      if (emp.department) setDepartment(emp.department);
    }
  }

  const canSubmit = employeeId && employeeName && department && activityType &&
    dateFrom && dateTo && location.trim() && purpose.trim() &&
    (isOvernight || (departureTime && returnExpected));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/offsite/declare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          employee_name: employeeName,
          department,
          activity_type: activityType,
          date_from: dateFrom,
          date_to: dateTo,
          departure_time: departureTime || null,
          return_expected: returnExpected || null,
          location,
          purpose,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? 'Submission failed');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={styles.successCard}>
        <div style={styles.successIcon}>✓</div>
        <h2 style={styles.successTitle}>Declaration Submitted</h2>
        <p style={styles.successBody}>
          Your off-site declaration has been sent to your approver. You will receive a
          WhatsApp or email once it has been reviewed.
        </p>
        <button style={styles.btn} onClick={() => { setDone(false); setEmployeeId(''); setEmployeeName(''); setDepartment(''); setActivityType(''); setDateFrom(todayStr()); setDateTo(todayStr()); setDepartureTime(''); setReturnExpected(''); setLocation(''); setPurpose(''); }}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={styles.form} noValidate>
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Who</h3>

        <div style={styles.field}>
          <label style={styles.label}>Employee *</label>
          {loadingEmp ? (
            <div style={styles.loadingPill}>Loading employees…</div>
          ) : (
            <select
              style={styles.select}
              value={employeeId}
              onChange={e => handleEmployeeChange(e.target.value)}
              required
            >
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.id})
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Department *</label>
          <select
            style={styles.select}
            value={department}
            onChange={e => setDepartment(e.target.value)}
            required
          >
            <option value="">Select department…</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Activity</h3>

        <div style={styles.chipGroup}>
          {ACTIVITY_TYPES.map(t => (
            <button
              key={t}
              type="button"
              style={{ ...styles.chip, ...(activityType === t ? styles.chipActive : {}) }}
              onClick={() => setActivityType(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>From Date *</label>
            <input
              type="date"
              style={styles.input}
              value={dateFrom}
              min={todayStr()}
              onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value); }}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>To Date *</label>
            <input
              type="date"
              style={styles.input}
              value={dateTo}
              min={dateFrom}
              onChange={e => setDateTo(e.target.value)}
              required
            />
          </div>
        </div>

        {!isOvernight && (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Departure Time *</label>
              <input
                type="time"
                style={styles.input}
                value={departureTime}
                onChange={e => setDepartureTime(e.target.value)}
                required={!isOvernight}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Expected Return *</label>
              <input
                type="time"
                style={styles.input}
                value={returnExpected}
                onChange={e => setReturnExpected(e.target.value)}
                required={!isOvernight}
              />
            </div>
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Details</h3>

        <div style={styles.field}>
          <label style={styles.label}>Destination / Location *</label>
          <input
            type="text"
            style={styles.input}
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Checkers Polokwane, Tzaneen depot"
            required
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Purpose / Reason *</label>
          <textarea
            style={{ ...styles.input, height: 80, resize: 'vertical' }}
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="Briefly describe the activity…"
            required
          />
        </div>
      </section>

      {error && <div style={styles.errorBanner}>{error}</div>}

      <button
        type="submit"
        disabled={!canSubmit || busy}
        style={{ ...styles.btn, ...((!canSubmit || busy) ? styles.btnDisabled : {}) }}
      >
        {busy ? 'Submitting…' : 'Submit Declaration'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  section: {
    background: 'var(--color-surface-base)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
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
  select: {
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
  row: {
    display: 'flex',
    gap: 12,
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 'var(--r-pill)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    fontWeight: 500,
    padding: '8px 16px',
    transition: 'all 0.15s',
  },
  chipActive: {
    background: 'var(--color-brand-primary)',
    border: '1px solid var(--color-brand-primary)',
    color: 'var(--color-text-on-brand)',
    fontWeight: 600,
  },
  btn: {
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
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  errorBanner: {
    background: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-bd)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-danger-fg)',
    fontSize: 14,
    padding: '12px 16px',
  },
  loadingPill: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-tertiary)',
    fontSize: 14,
    padding: '10px 14px',
  },
  successCard: {
    alignItems: 'center',
    background: 'var(--color-success-bg)',
    border: '1px solid var(--color-success-bd)',
    borderRadius: 'var(--r-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 40,
    textAlign: 'center',
  },
  successIcon: {
    alignItems: 'center',
    background: 'var(--color-brand-primary)',
    borderRadius: '50%',
    color: 'var(--color-text-on-brand)',
    display: 'flex',
    fontSize: 28,
    fontWeight: 700,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  successTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--color-success-fg)',
  },
  successBody: {
    color: 'var(--color-text-secondary)',
    fontSize: 15,
    maxWidth: 380,
    lineHeight: 1.6,
  },
};
