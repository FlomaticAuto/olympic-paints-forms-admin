'use client';
import { useState, useEffect, useRef, FormEvent } from 'react';

interface Props { formId: string; }

type Theme = 'theme-dark' | 'theme-light' | 'theme-navy';
const THEME_KEY = 'svb-theme';

interface Store {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  town: string | null;
  area: string | null;
}

const REPS = ['Bhadresh', 'Nikhil', 'Byron', 'Amit', 'Aboo', 'Quintus'];
const MERCHANDISERS = ['Goolat'];
const PURPOSES = [
  'Inventory Check',
  'Product Display Review',
  'Sales Training',
  'New Product Launch',
  'Merchandising',
  'Gazebo Day',
];
const TASKS = [
  'Inspect Stock Levels',
  'Update Product Displays',
  'Take Photos for Reports',
  'Conduct Staff Training',
  'Other',
];

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateRef(): string {
  const now = new Date();
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SVB-${yymmdd}-${rand}`;
}

export default function StoreVisitBookingForm({ formId }: Props) {
  const [reportRef] = useState(() => generateRef());
  const [theme, setThemeState] = useState<Theme>('theme-dark');

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'theme-light' || saved === 'theme-navy' || saved === 'theme-dark') {
      setThemeState(saved as Theme);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
  };

  // Store search
  const [storeQuery, setStoreQuery]     = useState('');
  const [storeResults, setStoreResults] = useState<Store[]>([]);
  const [storeOpen, setStoreOpen]       = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [bookedBy,       setBookedBy]       = useState('');
  const [purpose,        setPurpose]        = useState('');
  const [tasks,          setTasks]          = useState<string[]>([]);
  const [merchandiser,   setMerchandiser]   = useState('');
  const [manager,        setManager]        = useState('');
  const [visitDate,      setVisitDate]      = useState(todayLocal());
  const [visitTime,      setVisitTime]      = useState('');
  const [description,    setDescription]    = useState('');
  const [manualAddress,  setManualAddress]  = useState('');
  const [busy,         setBusy]         = useState(false);
  const [done,         setDone]         = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setStoreOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Debounced store search
  useEffect(() => {
    if (selectedStore) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (storeQuery.length < 2) {
      setStoreResults([]);
      setStoreOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setStoreLoading(true);
      try {
        const res = await fetch(`/api/stores/search?q=${encodeURIComponent(storeQuery)}`);
        const data = await res.json();
        setStoreResults(Array.isArray(data) ? data : []);
        setStoreOpen(true);
      } catch {
        setStoreResults([]);
      } finally {
        setStoreLoading(false);
      }
    }, 280);
  }, [storeQuery, selectedStore]);

  function selectStore(s: Store) {
    setSelectedStore(s);
    setStoreQuery(s.name);
    setStoreOpen(false);
    setStoreResults([]);
  }

  function clearStore() {
    setSelectedStore(null);
    setStoreQuery('');
    setStoreResults([]);
    setStoreOpen(false);
  }

  function toggleTask(t: string) {
    setTasks(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  const storeHasAddress = !!(selectedStore && (selectedStore.address || selectedStore.town));
  const needsManualAddress = selectedStore && !storeHasAddress;

  const canSubmit =
    bookedBy &&
    selectedStore &&
    purpose &&
    merchandiser &&
    manager.trim() &&
    visitDate &&
    visitTime &&
    (!needsManualAddress || manualAddress.trim().length > 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedStore) return;
    setBusy(true);
    setError(null);

    const resolvedAddress = storeHasAddress
      ? [selectedStore.address, selectedStore.town, selectedStore.area].filter(Boolean).join(', ')
      : manualAddress.trim();

    const data = {
      report_ref:    reportRef,
      booked_by:     bookedBy,
      store_id:      selectedStore.id,
      store_name:    selectedStore.name,
      store_code:    selectedStore.code ?? '',
      store_address: resolvedAddress,
      address_source: storeHasAddress ? 'database' : 'manual',
      purpose,
      tasks:         tasks.join(', '),
      merchandiser,
      manager_name:  manager,
      visit_date:    visitDate,
      visit_time:    visitTime,
      description,
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data,
          metadata: { form_type: 'store_visit_booking', report_ref: reportRef },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? 'Submission failed. Please try again.');
        setBusy(false);
        return;
      }
      // Fire-and-forget: append to Booking_Audit_Log.xlsx via local webhook
      fetch('/api/booking-audit-log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data }),
      }).catch(() => { /* non-fatal */ });

      // If manual address was entered, patch the store record silently
      if (!storeHasAddress && manualAddress.trim()) {
        fetch(`/api/stores/${selectedStore!.id}/update-address`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ address: manualAddress.trim() }),
        }).catch(() => { /* non-fatal */ });
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className={`svb-wrap ${theme}`}>
        <div className="svb-thanks">
          <div className="svb-check">✓</div>
          <h1>Visit Booked</h1>
          <p className="svb-ref">{reportRef}</p>
          <p className="svb-sub">
            Your store visit has been booked for{' '}
            <strong>{visitDate}</strong> at <strong>{visitTime}</strong>.
          </p>
          <button className="svb-submit" style={{ marginTop: 24 }} onClick={() => {
            setDone(false); setBusy(false); setError(null);
            setBookedBy(''); clearStore(); setPurpose(''); setTasks([]);
            setMerchandiser(''); setManager(''); setVisitDate(todayLocal());
            setVisitTime(''); setDescription(''); setManualAddress('');
          }}>
            Book Another Visit
          </button>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  const storeAddress = selectedStore
    ? [selectedStore.address, selectedStore.town, selectedStore.area].filter(Boolean).join(', ')
    : '';

  return (
    <main className={`svb-wrap ${theme}`}>
      <form onSubmit={onSubmit} className="svb-frame" noValidate>

        {/* ── Header ── */}
        <header className="svb-header">
          <div className="svb-logo-wrap">
            <img
              src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg"
              alt="Olympic Paints"
              width={36}
              height={36}
            />
          </div>
          <div className="svb-title-block">
            <div className="svb-eyebrow">Olympic Paints · Merchandising</div>
            <h1>Store Visit Booking</h1>
          </div>
          <div className="svb-meta">
            <div className="svb-meta-item">
              <span className="svb-meta-label">Ref</span>
              <span className="svb-meta-val">{reportRef}</span>
            </div>
          </div>
          <div className="svb-theme-toggle" role="group" aria-label="Display theme">
            {(['theme-dark', 'theme-light', 'theme-navy'] as Theme[]).map(t => (
              <button
                key={t}
                type="button"
                className={`svb-theme-btn${theme === t ? ' is-active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t === 'theme-dark' ? 'Dark' : t === 'theme-light' ? 'Light' : 'Navy'}
              </button>
            ))}
          </div>
        </header>

        {/* ── Body ── */}
        <div className="svb-body">

          {/* ── Section: Who & Where ── */}
          <div className="svb-section-label">Who &amp; Where</div>
          <div className="svb-row-2">

            {/* Booked By */}
            <div className="svb-field">
              <label className="svb-label">
                Merchandising Visit Booked By <span className="svb-req">*</span>
              </label>
              <div className="svb-pill-grid">
                {REPS.map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`svb-pill${bookedBy === r ? ' is-active' : ''}`}
                    onClick={() => setBookedBy(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Merchandiser */}
            <div className="svb-field">
              <label className="svb-label">
                Merchandiser <span className="svb-req">*</span>
              </label>
              <div className="svb-pill-grid">
                {MERCHANDISERS.map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`svb-pill${merchandiser === m ? ' is-active' : ''}`}
                    onClick={() => setMerchandiser(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Store Search ── */}
          <div className="svb-field" ref={searchRef}>
            <label className="svb-label">
              Store Name <span className="svb-req">*</span>
            </label>
            <div className="svb-search-wrap">
              <div className="svb-search-input-row">
                <span className="svb-search-icon">
                  {storeLoading ? '⟳' : '⌕'}
                </span>
                <input
                  type="text"
                  className="svb-input svb-search-input"
                  placeholder="Type store name, code or town…"
                  value={storeQuery}
                  onChange={e => { setStoreQuery(e.target.value); if (selectedStore) clearStore(); }}
                  onFocus={() => { if (storeResults.length > 0) setStoreOpen(true); }}
                  autoComplete="off"
                />
                {selectedStore && (
                  <button type="button" className="svb-search-clear" onClick={clearStore} aria-label="Clear store">
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {storeOpen && storeResults.length > 0 && (
                <ul className="svb-dropdown" role="listbox">
                  {storeResults.map(s => (
                    <li
                      key={s.id}
                      role="option"
                      className="svb-dropdown-item"
                      onMouseDown={() => selectStore(s)}
                    >
                      <span className="svb-dropdown-name">{s.name}</span>
                      {s.code && <span className="svb-dropdown-code">{s.code}</span>}
                      {(s.address || s.town) && (
                        <span className="svb-dropdown-addr">
                          {[s.address, s.town].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {storeOpen && !storeLoading && storeResults.length === 0 && storeQuery.length >= 2 && !selectedStore && (
                <div className="svb-dropdown svb-dropdown-empty">No stores found for "{storeQuery}"</div>
              )}
            </div>

            {/* Auto-populated address */}
            {selectedStore && storeHasAddress && (
              <div className="svb-store-card">
                <div className="svb-store-card-row">
                  <span className="svb-store-card-label">Code</span>
                  <span className="svb-store-card-val">{selectedStore.code ?? '—'}</span>
                </div>
                <div className="svb-store-card-row">
                  <span className="svb-store-card-label">Address</span>
                  <span className="svb-store-card-val">{storeAddress}</span>
                </div>
              </div>
            )}

            {/* Missing address — forced entry */}
            {needsManualAddress && (
              <div className="svb-missing-addr-block">
                <div className="svb-missing-addr-header">
                  <span className="svb-missing-addr-icon">⚠</span>
                  <span>No address on record for <strong>{selectedStore!.name}</strong></span>
                </div>
                <label className="svb-label" htmlFor="svb-manual-addr" style={{ marginTop: 10 }}>
                  Enter Exact Store Address <span className="svb-req">*</span>
                </label>
                <input
                  id="svb-manual-addr"
                  type="text"
                  className="svb-input svb-missing-addr-input"
                  placeholder="e.g. 12 Main Street, Tzaneen, Limpopo 0850"
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  required
                  autoFocus
                />
                <p className="svb-missing-addr-hint">
                  This will be saved to our database to prevent future lookups failing.
                </p>
              </div>
            )}
          </div>

          {/* ── Section: Visit Details ── */}
          <div className="svb-section-label">Visit Details</div>
          <div className="svb-row-2">

            {/* Purpose */}
            <div className="svb-field">
              <label className="svb-label">
                Purpose of Visit <span className="svb-req">*</span>
              </label>
              <div className="svb-pill-grid svb-pill-grid-3">
                {PURPOSES.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`svb-pill${purpose === p ? ' is-active' : ''}`}
                    onClick={() => setPurpose(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div className="svb-field">
              <label className="svb-label">What needs to be done</label>
              <div className="svb-checklist">
                {TASKS.map(t => (
                  <label key={t} className="svb-check-row">
                    <input
                      type="checkbox"
                      className="svb-checkbox"
                      checked={tasks.includes(t)}
                      onChange={() => toggleTask(t)}
                    />
                    <span className="svb-check-label">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Section: Schedule ── */}
          <div className="svb-section-label">Schedule</div>
          <div className="svb-row-3">

            {/* Manager */}
            <div className="svb-field">
              <label className="svb-label" htmlFor="svb-manager">
                Store Manager to Speak To <span className="svb-req">*</span>
              </label>
              <input
                id="svb-manager"
                type="text"
                className="svb-input"
                placeholder="Manager name"
                value={manager}
                onChange={e => setManager(e.target.value)}
                required
              />
            </div>

            {/* Date */}
            <div className="svb-field">
              <label className="svb-label" htmlFor="svb-date">
                Preferred Date <span className="svb-req">*</span>
              </label>
              <input
                id="svb-date"
                type="date"
                className="svb-input"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                required
              />
            </div>

            {/* Time */}
            <div className="svb-field">
              <label className="svb-label" htmlFor="svb-time">
                Preferred Time <span className="svb-req">*</span>
              </label>
              <input
                id="svb-time"
                type="time"
                className="svb-input"
                value={visitTime}
                onChange={e => setVisitTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="svb-field">
            <label className="svb-label" htmlFor="svb-desc">
              Description of What Needs to Be Done
            </label>
            <textarea
              id="svb-desc"
              className="svb-input svb-textarea"
              placeholder="Additional notes, specific instructions, products to focus on…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="svb-error">{error}</p>}

          <button
            type="submit"
            className="svb-submit"
            disabled={!canSubmit || busy}
          >
            {busy ? 'Booking…' : '✓ Book Store Visit'}
          </button>

        </div>
      </form>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  .svb-wrap {
    min-height: 100vh;
    margin: 0;
    padding: 16px;
    box-sizing: border-box;
    font-family: 'Barlow', sans-serif;
  }

  /* ── Themes ── */
  .svb-wrap.theme-dark {
    --p:    #0D0D0B;
    --base: #1A1A18;
    --elev: #2E2E2C;
    --sunken: #0D0D0B;
    --yellow: #F5C400;
    --yellow-h: #FAE04D;
    --text:  #E8E7E2;
    --muted: #949390;
    --dim:   #5C5B58;
    --border: rgba(255,255,255,0.10);
    --border-s: rgba(255,255,255,0.06);
    --focus: #F5C400;
    --sel-bg: #F5C400;
    --sel-fg: #0D0D0B;
    --sel-bd: #F5C400;
    --danger-bg: rgba(232,96,96,0.12);
    --danger-fg: #FDDCDC;
    --danger-bd: rgba(232,96,96,0.30);
    --success-bg: rgba(45,140,122,0.12);
    --success-fg: #C8EDE7;
    --section-bg: rgba(245,196,0,0.06);
    background: var(--p);
    color: var(--text);
  }
  .svb-wrap.theme-light {
    --p:    #F7F6F3;
    --base: #FFFFFF;
    --elev: #FFFFFF;
    --sunken: #F0EFEA;
    --yellow: #F5C400;
    --yellow-h: #D4A800;
    --text:  #0D0D0B;
    --muted: #5C5B58;
    --dim:   #949390;
    --border: #C8C7C0;
    --border-s: #E8E7E2;
    --focus: #1A3D6E;
    --sel-bg: #F5C400;
    --sel-fg: #0D0D0B;
    --sel-bd: #A88000;
    --danger-bg: #FEF2F2;
    --danger-fg: #C0392B;
    --danger-bd: #E86060;
    --success-bg: #EDF7F5;
    --success-fg: #1a5c50;
    --section-bg: rgba(245,196,0,0.08);
    background: var(--p);
    color: var(--text);
  }
  .svb-wrap.theme-navy {
    --p:    #071022;
    --base: #0D2040;
    --elev: #1A3D6E;
    --sunken: #071022;
    --yellow: #F5C400;
    --yellow-h: #FAE04D;
    --text:  #FFFFFF;
    --muted: #B8CCE8;
    --dim:   #6B9ED0;
    --border: rgba(107,158,208,0.20);
    --border-s: rgba(107,158,208,0.12);
    --focus: #F5C400;
    --sel-bg: #F5C400;
    --sel-fg: #071022;
    --sel-bd: #F5C400;
    --danger-bg: rgba(232,96,96,0.14);
    --danger-fg: #FDDCDC;
    --danger-bd: rgba(232,96,96,0.35);
    --success-bg: rgba(45,140,122,0.15);
    --success-fg: #C8EDE7;
    --section-bg: rgba(107,158,208,0.08);
    background: var(--p);
    color: var(--text);
  }

  /* ── Frame ── */
  .svb-frame {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── Header ── */
  .svb-header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--base);
    border: 1px solid var(--border);
    border-radius: 12px 12px 0 0;
    padding: 12px 16px;
  }
  .svb-logo-wrap {
    width: 36px; height: 36px;
    border-radius: 50%; overflow: hidden; flex-shrink: 0;
  }
  .svb-logo-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .svb-title-block { line-height: 1; }
  .svb-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--dim);
  }
  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 22px;
    text-transform: uppercase;
    color: var(--yellow);
    margin: 2px 0 0; line-height: 1;
  }
  .svb-meta { margin-left: auto; }
  .svb-meta-item { text-align: right; line-height: 1.1; }
  .svb-meta-label {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--dim);
  }
  .svb-meta-val {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 14px;
    color: var(--yellow);
  }

  /* ── Theme toggle ── */
  .svb-theme-toggle {
    display: flex; gap: 3px;
    background: var(--sunken);
    border-radius: 8px; padding: 3px;
    margin-left: 10px;
  }
  .svb-theme-btn {
    background: transparent; border: 0;
    color: var(--muted);
    border-radius: 6px; padding: 6px 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    cursor: pointer; min-height: 32px;
    transition: background 0.12s, color 0.12s;
  }
  .svb-theme-btn:hover { background: var(--elev); color: var(--text); }
  .svb-theme-btn.is-active { background: var(--sel-bg); color: var(--sel-fg); font-weight: 900; }
  .svb-theme-btn:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

  /* ── Body ── */
  .svb-body {
    background: var(--base);
    border: 1px solid var(--border);
    border-top: 0;
    border-radius: 0 0 12px 12px;
    padding: 20px 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Section labels ── */
  .svb-section-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--yellow);
    background: var(--section-bg);
    border-left: 3px solid var(--yellow);
    padding: 6px 10px;
    border-radius: 0 6px 6px 0;
    margin-top: 4px;
  }

  /* ── Layout grids ── */
  .svb-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .svb-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

  /* ── Field wrapper ── */
  .svb-field { display: flex; flex-direction: column; gap: 7px; }
  .svb-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted);
  }
  .svb-req { color: var(--yellow); }

  /* ── Pill selector ── */
  .svb-pill-grid {
    display: flex; flex-wrap: wrap; gap: 6px;
  }
  .svb-pill-grid-3 {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
  }
  .svb-pill {
    background: var(--sunken);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 8px;
    padding: 9px 14px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.04em;
    cursor: pointer; min-height: 40px;
    transition: background 0.1s, border-color 0.1s;
    white-space: nowrap;
  }
  .svb-pill:hover { background: var(--elev); border-color: var(--yellow); }
  .svb-pill.is-active {
    background: var(--sel-bg); color: var(--sel-fg);
    border-color: var(--sel-bd); font-weight: 900;
  }
  .svb-pill:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }

  /* ── Text inputs ── */
  .svb-input {
    width: 100%; box-sizing: border-box;
    padding: 10px 12px; min-height: 42px;
    font-size: 14px; font-family: 'Barlow', sans-serif;
    background: var(--sunken); color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px; appearance: none; -webkit-appearance: none;
    transition: border-color 0.12s;
  }
  .svb-input:focus {
    outline: none;
    border-color: var(--yellow);
    box-shadow: 0 0 0 3px rgba(245,196,0,0.18);
  }
  .svb-textarea { min-height: 84px; resize: vertical; }

  /* ── Store search ── */
  .svb-search-wrap { position: relative; }
  .svb-search-input-row {
    position: relative; display: flex; align-items: center;
  }
  .svb-search-icon {
    position: absolute; left: 12px;
    color: var(--dim); font-size: 16px; pointer-events: none;
    line-height: 1;
  }
  .svb-search-input { padding-left: 34px; padding-right: 36px; }
  .svb-search-clear {
    position: absolute; right: 10px;
    background: transparent; border: 0;
    color: var(--muted); font-size: 18px; line-height: 1;
    cursor: pointer; padding: 4px 6px;
    border-radius: 4px;
  }
  .svb-search-clear:hover { color: var(--text); }

  /* ── Dropdown ── */
  .svb-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 100;
    background: var(--elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    max-height: 280px; overflow-y: auto;
    list-style: none; margin: 0; padding: 4px 0;
  }
  .svb-dropdown-empty {
    padding: 12px 14px;
    color: var(--muted); font-size: 13px;
    font-style: italic;
  }
  .svb-dropdown-item {
    padding: 10px 14px; cursor: pointer;
    display: flex; flex-direction: column; gap: 2px;
    transition: background 0.08s;
  }
  .svb-dropdown-item:hover { background: var(--section-bg); }
  .svb-dropdown-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 14px;
    color: var(--text);
  }
  .svb-dropdown-code {
    font-size: 11px; font-weight: 600;
    color: var(--yellow); letter-spacing: 0.06em;
  }
  .svb-dropdown-addr {
    font-size: 12px; color: var(--muted);
  }

  /* ── Store card (auto-populated) ── */
  .svb-store-card {
    background: var(--success-bg);
    border: 1px solid rgba(45,140,122,0.25);
    border-radius: 8px; padding: 10px 14px;
    display: flex; flex-direction: column; gap: 4px;
    margin-top: 8px;
  }
  .svb-store-card-row { display: flex; gap: 8px; align-items: baseline; }
  .svb-store-card-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--success-fg); min-width: 52px;
  }
  .svb-store-card-val {
    font-size: 13px; color: var(--success-fg);
  }

  /* ── Missing address block ── */
  .svb-missing-addr-block {
    margin-top: 8px;
    background: var(--danger-bg);
    border: 2px solid var(--danger-bd);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .svb-missing-addr-header {
    display: flex; align-items: center; gap: 8px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 13px;
    color: var(--danger-fg);
  }
  .svb-missing-addr-icon { font-size: 16px; flex-shrink: 0; }
  .svb-missing-addr-input {
    border-color: var(--danger-bd) !important;
    background: var(--sunken);
  }
  .svb-missing-addr-input:focus {
    border-color: var(--danger-bd) !important;
    box-shadow: 0 0 0 3px rgba(232,96,96,0.20) !important;
  }
  .svb-missing-addr-hint {
    font-size: 11px; color: var(--danger-fg); opacity: 0.75;
    margin: 2px 0 0;
  }

  /* ── Checklist ── */
  .svb-checklist { display: flex; flex-direction: column; gap: 6px; }
  .svb-check-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    background: var(--sunken);
    border: 1px solid var(--border-s);
    border-radius: 7px; cursor: pointer;
    transition: background 0.08s;
  }
  .svb-check-row:hover { background: var(--elev); }
  .svb-checkbox {
    width: 18px; height: 18px; flex-shrink: 0;
    accent-color: var(--yellow); cursor: pointer;
  }
  .svb-check-label {
    font-size: 13px; color: var(--text); user-select: none;
  }

  /* ── Error ── */
  .svb-error {
    color: var(--danger-fg); background: var(--danger-bg);
    border: 1px solid var(--danger-bd);
    padding: 10px 14px; border-radius: 8px;
    font-size: 13px; margin: 0;
  }

  /* ── Submit ── */
  .svb-submit {
    width: 100%; padding: 14px; min-height: 50px;
    background: var(--yellow); color: var(--sunken);
    border: 0; border-radius: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 16px;
    text-transform: uppercase; letter-spacing: 0.1em;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
  }
  .svb-submit:hover:not(:disabled) { background: var(--yellow-h); }
  .svb-submit:disabled { opacity: 0.45; cursor: not-allowed; }
  .svb-submit:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }

  /* ── Thanks screen ── */
  .svb-thanks {
    max-width: 520px; margin: 80px auto;
    background: var(--base); border: 1px solid var(--border);
    border-radius: 12px; padding: 40px 28px;
    text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }
  .svb-check { font-size: 52px; color: #2D8C7A; margin-bottom: 16px; }
  .svb-ref {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 22px;
    color: var(--yellow); margin: 8px 0; letter-spacing: 0.04em;
  }
  .svb-sub {
    color: var(--muted); font-size: 15px;
    line-height: 1.6; margin-top: 12px;
  }

  /* ── Responsive ── */
  @media (max-width: 680px) {
    .svb-row-2, .svb-row-3 { grid-template-columns: 1fr; }
    .svb-pill-grid-3 { grid-template-columns: 1fr 1fr; }
    .svb-header { flex-wrap: wrap; }
    .svb-meta { margin-left: auto; }
    .svb-theme-toggle { margin-left: 0; width: 100%; }
  }
`;
