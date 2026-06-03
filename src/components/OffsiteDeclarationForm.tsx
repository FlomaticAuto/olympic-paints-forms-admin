'use client';
import { useState, useEffect, useRef, FormEvent } from 'react';

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  employer: string;
}

const ACTIVITY_TYPES = ['Overnight Stay', 'Field Visit', 'Delivery Run', 'Training', 'Other'];

const DEPARTMENTS = [
  'Merchandising', 'Sales', 'Delivery', 'Operations',
  'HR', 'Admin', 'Primeserve', 'Other',
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function OffsiteDeclarationForm() {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loadingEmp, setLoadingEmp]   = useState(true);

  // Step 1: department
  const [department,    setDepartment]    = useState('');
  // Step 2: employee typeahead
  const [empSearch,     setEmpSearch]     = useState('');
  const [employeeId,    setEmployeeId]    = useState('');
  const [employeeName,  setEmployeeName]  = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Step 3+
  const [activityType,   setActivityType]   = useState('');
  const [dateFrom,       setDateFrom]       = useState(todayStr());
  const [dateTo,         setDateTo]         = useState(todayStr());
  const [departureTime,  setDepartureTime]  = useState('');
  const [returnExpected, setReturnExpected] = useState('');
  const [location,       setLocation]       = useState('');
  const [purpose,        setPurpose]        = useState('');

  const [busy,  setBusy]  = useState(false);
  const [done,  setDone]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOvernight = activityType === 'Overnight Stay';

  useEffect(() => {
    fetch('/api/offsite/employees')
      .then(r => r.json())
      .then((d: { employees: Employee[] }) => { setAllEmployees(d.employees ?? []); setLoadingEmp(false); })
      .catch(() => setLoadingEmp(false));
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Employees filtered by department (if chosen), then by search text
  const filteredEmployees = allEmployees
    .filter(e => !department || !e.department || e.department === department)
    .filter(e => {
      if (!empSearch.trim()) return false;
      const q = empSearch.toLowerCase();
      return e.full_name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
    })
    .slice(0, 8);

  function selectEmployee(emp: Employee) {
    setEmployeeId(emp.id);
    setEmployeeName(emp.full_name);
    setEmpSearch(emp.full_name);
    if (emp.department && !department) setDepartment(emp.department);
    setShowSuggestions(false);
  }

  function handleDepartmentChange(dept: string) {
    setDepartment(dept);
    // Clear employee if they don't belong to the new dept
    if (employeeId) {
      const emp = allEmployees.find(e => e.id === employeeId);
      if (emp && emp.department && emp.department !== dept) {
        setEmployeeId('');
        setEmployeeName('');
        setEmpSearch('');
      }
    }
  }

  const empSelected = !!employeeId;

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

  function resetForm() {
    setDone(false); setDepartment(''); setEmployeeId(''); setEmployeeName('');
    setEmpSearch(''); setActivityType(''); setDateFrom(todayStr());
    setDateTo(todayStr()); setDepartureTime(''); setReturnExpected('');
    setLocation(''); setPurpose(''); setError(null);
  }

  if (done) {
    return (
      <div style={s.successCard}>
        <div style={s.successIcon}>✓</div>
        <h2 style={s.successTitle}>Declaration Submitted</h2>
        <p style={s.successBody}>
          Your off-site declaration has been sent for approval. You will receive a
          WhatsApp message once it has been reviewed.
        </p>
        <button style={s.submitBtn} onClick={resetForm}>Submit Another</button>
      </div>
    );
  }

  return (
    <>
      {/* Mobile-responsive styles injected via style tag */}
      <style>{`
        .offsite-row { display: flex; gap: 12px; }
        @media (max-width: 520px) {
          .offsite-row { flex-direction: column; gap: 0; }
        }
        .offsite-chip-group { display: flex; flex-wrap: wrap; gap: 10px; }
        .offsite-chip {
          background: var(--color-surface-elevated);
          border: 2px solid var(--color-border-default);
          border-radius: 50px;
          color: var(--color-text-secondary);
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 12px 20px;
          text-transform: uppercase;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .offsite-chip.active {
          background: var(--color-brand-primary);
          border-color: var(--color-brand-primary);
          color: var(--color-text-on-brand);
        }
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .dept-btn {
          background: var(--color-surface-elevated);
          border: 2px solid var(--color-border-default);
          border-radius: var(--r-md);
          color: var(--color-text-primary);
          cursor: pointer;
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.04em;
          padding: 14px 10px;
          text-align: center;
          text-transform: uppercase;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }
        .dept-btn.active {
          background: var(--color-brand-primary);
          border-color: var(--color-brand-primary);
          color: var(--color-text-on-brand);
        }
        .dept-btn:hover:not(.active) {
          border-color: var(--color-brand-primary);
          color: var(--color-brand-primary);
        }
        .suggestion-item {
          padding: 14px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--color-border-subtle);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .suggestion-item:last-child { border-bottom: none; }
        .suggestion-item:hover, .suggestion-item:focus {
          background: var(--color-surface-overlay);
        }
        .suggestion-name {
          font-family: var(--font-body);
          font-size: 17px;
          font-weight: 600;
          color: var(--color-text-primary);
        }
        .suggestion-meta {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        input[type="date"], input[type="time"] {
          color-scheme: dark;
        }
        .theme-light input[type="date"],
        .theme-light input[type="time"],
        .theme-brand input[type="date"],
        .theme-brand input[type="time"] {
          color-scheme: light;
        }
      `}</style>

      <form onSubmit={onSubmit} style={s.form} noValidate>

        {/* ── STEP 1: DEPARTMENT ── */}
        <section style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.stepBadge}>1</span>
            <h3 style={s.sectionTitle}>Select Your Department</h3>
          </div>
          <div className="dept-grid">
            {DEPARTMENTS.map(d => (
              <button
                key={d}
                type="button"
                className={`dept-btn${department === d ? ' active' : ''}`}
                onClick={() => handleDepartmentChange(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* ── STEP 2: EMPLOYEE SEARCH ── */}
        <section style={{ ...s.section, ...(department ? {} : s.sectionLocked) }}>
          <div style={s.sectionHeader}>
            <span style={s.stepBadge}>2</span>
            <h3 style={s.sectionTitle}>Find Your Name</h3>
          </div>
          {loadingEmp ? (
            <div style={s.loadingPill}>Loading employees…</div>
          ) : (
            <div ref={searchRef} style={{ position: 'relative' }}>
              <div style={s.searchInputWrap}>
                <span style={s.searchIcon}>🔍</span>
                <input
                  type="text"
                  style={s.searchInput}
                  placeholder={department
                    ? `Type your name to search${department !== 'Other' ? ` in ${department}` : ''}…`
                    : 'Select a department first…'}
                  value={empSearch}
                  disabled={!department}
                  onChange={e => {
                    setEmpSearch(e.target.value);
                    setEmployeeId('');
                    setEmployeeName('');
                    setShowSuggestions(true);
                  }}
                  onFocus={() => { if (empSearch) setShowSuggestions(true); }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {empSelected && (
                  <span style={s.empConfirmed}>✓</span>
                )}
              </div>

              {/* Suggestion dropdown */}
              {showSuggestions && filteredEmployees.length > 0 && (
                <div style={s.suggestionsBox}>
                  {filteredEmployees.map(emp => (
                    <div
                      key={emp.id}
                      className="suggestion-item"
                      onMouseDown={() => selectEmployee(emp)}
                    >
                      <span className="suggestion-name">{emp.full_name}</span>
                      <span className="suggestion-meta">{emp.id} · {emp.employer}</span>
                    </div>
                  ))}
                </div>
              )}

              {showSuggestions && empSearch.length > 0 && filteredEmployees.length === 0 && (
                <div style={s.suggestionsBox}>
                  <div style={{ padding: '14px 16px', color: 'var(--color-text-tertiary)', fontSize: 15 }}>
                    No employees found for &ldquo;{empSearch}&rdquo;
                  </div>
                </div>
              )}

              {/* Confirmed employee badge */}
              {empSelected && (
                <div style={s.empBadge}>
                  <strong style={{ fontSize: 17 }}>{employeeName}</strong>
                  <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}> — {employeeId}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── STEP 3: ACTIVITY TYPE ── */}
        <section style={{ ...s.section, ...(empSelected ? {} : s.sectionLocked) }}>
          <div style={s.sectionHeader}>
            <span style={s.stepBadge}>3</span>
            <h3 style={s.sectionTitle}>What Are You Doing?</h3>
          </div>
          <div className="offsite-chip-group">
            {ACTIVITY_TYPES.map(t => (
              <button
                key={t}
                type="button"
                className={`offsite-chip${activityType === t ? ' active' : ''}`}
                onClick={() => setActivityType(t)}
                disabled={!empSelected}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* ── STEP 4: DATES & TIMES ── */}
        <section style={{ ...s.section, ...(activityType ? {} : s.sectionLocked) }}>
          <div style={s.sectionHeader}>
            <span style={s.stepBadge}>4</span>
            <h3 style={s.sectionTitle}>When?</h3>
          </div>

          <div className="offsite-row">
            <div style={s.field}>
              <label style={s.label}>From Date *</label>
              <input
                type="date"
                style={s.input}
                value={dateFrom}
                min={todayStr()}
                onChange={e => { setDateFrom(e.target.value); if (e.target.value > dateTo) setDateTo(e.target.value); }}
                required
                disabled={!activityType}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>To Date *</label>
              <input
                type="date"
                style={s.input}
                value={dateTo}
                min={dateFrom}
                onChange={e => setDateTo(e.target.value)}
                required
                disabled={!activityType}
              />
            </div>
          </div>

          {!isOvernight && activityType && (
            <div className="offsite-row">
              <div style={s.field}>
                <label style={s.label}>Departure Time *</label>
                <input
                  type="time"
                  style={s.input}
                  value={departureTime}
                  onChange={e => setDepartureTime(e.target.value)}
                  required={!isOvernight}
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Expected Return *</label>
                <input
                  type="time"
                  style={s.input}
                  value={returnExpected}
                  onChange={e => setReturnExpected(e.target.value)}
                  required={!isOvernight}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── STEP 5: DETAILS ── */}
        <section style={{ ...s.section, ...(activityType ? {} : s.sectionLocked) }}>
          <div style={s.sectionHeader}>
            <span style={s.stepBadge}>5</span>
            <h3 style={s.sectionTitle}>Details</h3>
          </div>

          <div style={s.field}>
            <label style={s.label}>Destination / Location *</label>
            <input
              type="text"
              style={s.input}
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Checkers Polokwane, Tzaneen depot"
              disabled={!activityType}
              required
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Purpose / Reason *</label>
            <textarea
              style={{ ...s.input, height: 100, resize: 'vertical' as const }}
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Briefly describe the activity and reason for being off-site…"
              disabled={!activityType}
              required
            />
          </div>
        </section>

        {error && <div style={s.errorBanner}>{error}</div>}

        <button
          type="submit"
          disabled={!canSubmit || busy}
          style={{ ...s.submitBtn, ...(!canSubmit || busy ? s.btnDisabled : {}) }}
        >
          {busy ? 'Submitting…' : 'Submit Declaration'}
        </button>

      </form>
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  section: {
    background: 'var(--color-surface-base)',
    border: '1.5px solid var(--color-border-default)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  sectionLocked: {
    opacity: 0.45,
    pointerEvents: 'none',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  stepBadge: {
    alignItems: 'center',
    background: 'var(--color-brand-primary)',
    borderRadius: '50%',
    color: 'var(--color-text-on-brand)',
    display: 'flex',
    flexShrink: 0,
    fontFamily: 'var(--font-display)',
    fontSize: 15,
    fontWeight: 900,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
  },
  label: {
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--color-text-secondary)',
  },
  input: {
    background: 'var(--color-surface-elevated)',
    border: '1.5px solid var(--color-border-default)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 17,
    padding: '14px 16px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    WebkitAppearance: 'none',
  },
  searchInputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    fontSize: 18,
    pointerEvents: 'none',
    zIndex: 1,
  },
  searchInput: {
    background: 'var(--color-surface-elevated)',
    border: '2px solid var(--color-brand-primary)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 18,
    fontWeight: 500,
    padding: '16px 48px 16px 46px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    WebkitAppearance: 'none',
  },
  empConfirmed: {
    position: 'absolute',
    right: 16,
    fontSize: 20,
    color: 'var(--color-success-fg)',
    fontWeight: 700,
  },
  suggestionsBox: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    background: 'var(--color-surface-elevated)',
    border: '1.5px solid var(--color-border-strong)',
    borderRadius: 'var(--r-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 50,
    overflow: 'hidden',
  },
  empBadge: {
    marginTop: 10,
    background: 'var(--color-success-bg)',
    border: '1.5px solid var(--color-success-bd)',
    borderRadius: 'var(--r-md)',
    padding: '12px 16px',
    color: 'var(--color-success-fg)',
    fontSize: 15,
  },
  loadingPill: {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-tertiary)',
    fontSize: 16,
    padding: '14px 16px',
  },
  errorBanner: {
    background: 'var(--color-danger-bg)',
    border: '1.5px solid var(--color-danger-bd)',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-danger-fg)',
    fontSize: 16,
    fontWeight: 500,
    padding: '14px 18px',
  },
  submitBtn: {
    background: 'var(--color-brand-primary)',
    border: 'none',
    borderRadius: 'var(--r-md)',
    color: 'var(--color-text-on-brand)',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: '0.08em',
    padding: '18px 28px',
    textTransform: 'uppercase',
    width: '100%',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  successCard: {
    alignItems: 'center',
    background: 'var(--color-success-bg)',
    border: '1.5px solid var(--color-success-bd)',
    borderRadius: 'var(--r-xl)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: 40,
    textAlign: 'center',
  },
  successIcon: {
    alignItems: 'center',
    background: 'var(--color-brand-primary)',
    borderRadius: '50%',
    color: 'var(--color-text-on-brand)',
    display: 'flex',
    fontSize: 32,
    fontWeight: 700,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  successTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    fontWeight: 900,
    textTransform: 'uppercase',
    color: 'var(--color-success-fg)',
    margin: 0,
  },
  successBody: {
    color: 'var(--color-text-secondary)',
    fontSize: 17,
    maxWidth: 380,
    lineHeight: 1.7,
    margin: 0,
  },
};
