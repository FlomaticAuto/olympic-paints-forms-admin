'use client';
import { useState, useEffect } from 'react';

type Theme = 'theme-dark' | 'theme-light' | 'theme-navy';
const THEME_KEY = 'qcl-theme';
const ADMIN_KEY = 'qcl-admin';

// ── Reference data ─────────────────────────────────────────────────────────
// Sales reps (code + full name). Codes match the KPI dashboard.
const REPS: { code: string; name: string }[] = [
  { code: 'AC', name: 'Aboo Cassim' },
  { code: 'AP', name: 'Amit Patel' },
  { code: 'BV', name: 'Bhadresh Vallabh' },
  { code: 'BM', name: 'Byron Minnie' },
  { code: 'NP', name: 'Nikhil Panchal' },
];

// Who is logging the event — the sales-admin team.
const ADMINS = ['Aziza', 'Emeshnee'];

const EVENT_TYPES = [
  'New Quote',
  'Quote Revision',
  'Price-List Change Request',
  'Pricing Error / Correction',
] as const;
type EventType = typeof EVENT_TYPES[number];

// The core of a rework log: countable reason codes for Pareto analysis.
const REASON_CODES = [
  'Rep changed price',
  'Rep changed quantity / product',
  'Customer renegotiated',
  'Price list out of date',
  'Rep quoted wrong price',
  'Discount approval needed',
  'Duplicate / re-request',
  'Other',
];

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const BLANK = {
  rep_code: '',
  event_type: '' as EventType | '',
  account: '',
  reason_code: '',
  revision_no: 1,
  note: '',
};

export default function QuoteChangeForm() {
  const [theme, setThemeState] = useState<Theme>('theme-light');
  const [admin, setAdminState] = useState(ADMINS[0]);
  const [eventDate, setEventDate] = useState(todayLocal);
  const [f, setF] = useState({ ...BLANK });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<string | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === 'theme-dark' || t === 'theme-light' || t === 'theme-navy') setThemeState(t);
    const a = window.localStorage.getItem(ADMIN_KEY);
    if (a) setAdminState(a);
  }, []);

  const setTheme = (t: Theme) => { setThemeState(t); window.localStorage.setItem(THEME_KEY, t); };
  const setAdmin = (a: string) => { setAdminState(a); window.localStorage.setItem(ADMIN_KEY, a); };
  const set = <K extends keyof typeof BLANK>(k: K, v: typeof BLANK[K]) => setF(p => ({ ...p, [k]: v }));

  // Revision # only makes sense for a quote revision.
  const showRevision = f.event_type === 'Quote Revision';

  async function submit() {
    if (!f.rep_code) { setError('Select which rep this is for.'); return; }
    if (!f.event_type) { setError('Select the event type.'); return; }
    if (!f.reason_code) { setError('Select a reason code.'); return; }
    setBusy(true); setError(null);
    const repName = REPS.find(r => r.code === f.rep_code)?.name ?? null;
    try {
      const res = await fetch('/api/quote-changes/log', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rep_code: f.rep_code,
          rep_name: repName,
          logged_by: admin,
          event_date: eventDate,
          event_type: f.event_type,
          account: f.account,
          reason_code: f.reason_code,
          revision_no: showRevision ? f.revision_no : null,
          note: f.note,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Save failed.'); setBusy(false); return; }
      setDoneRef(j.entry_ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error'); setBusy(false);
    }
  }

  // Log another — keep rep + date so a batch of the same rep's events is fast.
  function logAnother(keepRep: boolean) {
    setDoneRef(null); setBusy(false); setError(null);
    setF(p => ({ ...BLANK, rep_code: keepRep ? p.rep_code : '' }));
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (doneRef) {
    return (
      <main className={`qc-wrap ${theme}`}>
        <div className="qc-thanks">
          <div className="qc-check">✓</div>
          <h1>Logged</h1>
          <p className="qc-thanks-ref">{doneRef}</p>
          <p className="qc-thanks-sub">This change has been recorded for reporting.</p>
          <div className="qc-thanks-btns">
            <button className="qc-btn qc-btn-primary" onClick={() => logAnother(true)}>
              Log Another (same rep)
            </button>
            <button className="qc-btn qc-btn-ghost" onClick={() => logAnother(false)}>
              Log Another (new rep)
            </button>
          </div>
          <a className="qc-help-link" href="/quote-changes-guide.html" target="_blank" rel="noopener noreferrer">
            How to use this form ↗
          </a>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <main className={`qc-wrap ${theme}`}>
      <div className="qc-shell">

        {/* Header */}
        <header className="qc-header">
          <div className="qc-brand">
            <span className="qc-disc" aria-hidden="true" />
            <div className="qc-brand-text">
              <span className="qc-brand-name">Olympic Paints</span>
              <span className="qc-brand-sub">Quote &amp; Price Change Log</span>
            </div>
          </div>
          <div className="qc-theme-toggle" role="group" aria-label="Display theme">
            {(['theme-dark', 'theme-light', 'theme-navy'] as Theme[]).map(t => (
              <button key={t} type="button"
                className={`qc-theme-btn${theme === t ? ' is-active' : ''}`}
                onClick={() => setTheme(t)}>
                {t === 'theme-dark' ? 'Dark' : t === 'theme-light' ? 'Light' : 'Navy'}
              </button>
            ))}
          </div>
        </header>

        {/* Topbar: logged-by + date */}
        <div className="qc-topbar">
          <div className="qc-field-inline">
            <label className="qc-mini-label">Logged by</label>
            <select className="qc-input qc-input-sm" value={admin} onChange={e => setAdmin(e.target.value)}>
              {ADMINS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="qc-field-inline">
            <label className="qc-mini-label">Date</label>
            <input className="qc-input qc-input-sm" type="date" value={eventDate}
              onChange={e => setEventDate(e.target.value)} />
          </div>
        </div>

        {/* Body */}
        <div className="qc-body">
          <div className="qc-form">

            {/* Rep */}
            <div className="qc-section-title">Rep <span className="qc-req">*</span></div>
            <div className="qc-grid qc-grid-reps">
              {REPS.map(r => (
                <button key={r.code} type="button"
                  className={`qc-choice${f.rep_code === r.code ? ' is-active' : ''}`}
                  onClick={() => { set('rep_code', r.code); setError(null); }}>
                  <span className="qc-choice-code">{r.code}</span>
                  <span className="qc-choice-name">{r.name}</span>
                </button>
              ))}
            </div>

            {/* Event type */}
            <div className="qc-section-title">Event Type <span className="qc-req">*</span></div>
            <div className="qc-grid qc-grid-2">
              {EVENT_TYPES.map(t => (
                <button key={t} type="button"
                  className={`qc-choice qc-choice-wide${f.event_type === t ? ' is-active' : ''}`}
                  onClick={() => { set('event_type', t); setError(null); }}>
                  <span className="qc-choice-name">{t}</span>
                </button>
              ))}
            </div>

            {/* Account */}
            <div className="qc-section-title">Account / Customer</div>
            <div className="qc-field">
              <input className="qc-input" value={f.account} autoComplete="off"
                placeholder="Customer or account name"
                onChange={e => set('account', e.target.value)} />
            </div>

            {/* Reason code */}
            <div className="qc-section-title">Reason <span className="qc-req">*</span></div>
            <div className="qc-grid qc-grid-2">
              {REASON_CODES.map(rc => (
                <button key={rc} type="button"
                  className={`qc-choice qc-choice-wide${f.reason_code === rc ? ' is-active' : ''}`}
                  onClick={() => { set('reason_code', rc); setError(null); }}>
                  <span className="qc-choice-name">{rc}</span>
                </button>
              ))}
            </div>

            {/* Revision # — only for quote revisions */}
            {showRevision && (
              <>
                <div className="qc-section-title">Revision Number
                  <span className="qc-section-note">How many times this quote has now been redone</span>
                </div>
                <div className="qc-stepper">
                  <button type="button" className="qc-step-btn"
                    onClick={() => set('revision_no', Math.max(1, f.revision_no - 1))}
                    aria-label="Decrease">−</button>
                  <span className="qc-step-value">{f.revision_no}</span>
                  <button type="button" className="qc-step-btn"
                    onClick={() => set('revision_no', f.revision_no + 1)}
                    aria-label="Increase">+</button>
                </div>
              </>
            )}

            {/* Note */}
            <div className="qc-section-title">Note</div>
            <div className="qc-field">
              <textarea className="qc-input qc-textarea" value={f.note}
                placeholder="Optional — anything worth remembering about this change…"
                onChange={e => set('note', e.target.value)} />
            </div>

            {error && <p className="qc-error">{error}</p>}
            <button className="qc-btn qc-btn-primary qc-submit" onClick={submit} disabled={busy}>
              {busy ? 'Saving…' : 'Log Change'}
            </button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  .qc-wrap.theme-dark {
    --p:#0D0D0B; --base:#1A1A18; --elev:#2E2E2C; --sunken:#0D0D0B;
    --gold:#F6C324; --gold-h:#FAE04D; --text:#E8E7E2; --muted:#949390; --dim:#5C5B58;
    --border:rgba(255,255,255,0.10); --border-s:rgba(255,255,255,0.06);
    --sel-bg:#F6C324; --sel-fg:#0D0D0B; --focus:#F6C324;
    --danger-bg:rgba(232,96,96,0.12); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.30);
    --section-bg:rgba(246,195,36,0.06);
    background:var(--p); color:var(--text);
  }
  .qc-wrap.theme-light {
    --p:#F7F6F3; --base:#FFFFFF; --elev:#FFFFFF; --sunken:#F0EFEA;
    --gold:#E6A700; --gold-h:#C88F00; --text:#0D0D0B; --muted:#5C5B58; --dim:#949390;
    --border:#C8C7C0; --border-s:#E8E7E2;
    --sel-bg:#F6C324; --sel-fg:#0D0D0B; --focus:#1A3D6E;
    --danger-bg:#FEF2F2; --danger-fg:#C0392B; --danger-bd:#E86060;
    --section-bg:rgba(246,195,36,0.10);
    background:var(--p); color:var(--text);
  }
  .qc-wrap.theme-navy {
    --p:#071022; --base:#0D2040; --elev:#1A3D6E; --sunken:#071022;
    --gold:#F6C324; --gold-h:#FAE04D; --text:#FFFFFF; --muted:#B8CCE8; --dim:#6B9ED0;
    --border:rgba(107,158,208,0.20); --border-s:rgba(107,158,208,0.12);
    --sel-bg:#F6C324; --sel-fg:#071022; --focus:#F6C324;
    --danger-bg:rgba(232,96,96,0.14); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.35);
    --section-bg:rgba(107,158,208,0.08);
    background:var(--p); color:var(--text);
  }

  .qc-wrap { min-height:100vh; margin:0; padding:0; font-family:'Barlow',sans-serif; -webkit-tap-highlight-color:rgba(0,0,0,0); -webkit-text-size-adjust:100%; overscroll-behavior-y:contain; }
  .qc-shell { max-width:720px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; background:var(--base); }

  /* Header */
  .qc-header {
    display:flex; align-items:center; gap:12px;
    padding:12px 18px; background:var(--base);
    border-bottom:1px solid var(--border); position:sticky; top:0; z-index:50;
    padding-top:calc(12px + env(safe-area-inset-top));
  }
  .qc-brand { display:flex; align-items:center; gap:11px; }
  .qc-disc { width:34px; height:34px; border-radius:50%; background:var(--gold); flex-shrink:0; box-shadow:0 2px 8px rgba(246,195,36,0.25); }
  .qc-brand-text { display:flex; flex-direction:column; line-height:1; }
  .qc-brand-name { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; text-transform:uppercase; letter-spacing:0.02em; color:var(--text); }
  .qc-brand-sub { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:var(--gold); margin-top:2px; }
  .qc-theme-toggle { display:flex; gap:3px; background:var(--sunken); border-radius:8px; padding:3px; margin-left:auto; }
  .qc-theme-btn {
    background:transparent; border:0; color:var(--muted); border-radius:6px; padding:8px 13px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer; min-height:36px; transition:.12s;
  }
  .qc-theme-btn:hover { background:var(--elev); color:var(--text); }
  .qc-theme-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); font-weight:900; }

  /* Topbar */
  .qc-topbar {
    display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap;
    padding:14px 18px; background:var(--sunken); border-bottom:1px solid var(--border);
  }
  .qc-field-inline { display:flex; flex-direction:column; gap:5px; }
  .qc-mini-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.12em; color:var(--dim); }

  /* Body / form */
  .qc-body { padding:18px 18px calc(40px + env(safe-area-inset-bottom)); flex:1; }
  .qc-form { display:flex; flex-direction:column; gap:12px; }
  .qc-section-title {
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:15px;
    text-transform:uppercase; letter-spacing:0.04em; color:var(--gold);
    border-bottom:1px solid var(--border); padding-bottom:7px; margin-top:6px;
    display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  }
  .qc-section-title:first-child { margin-top:0; }
  .qc-section-note { font-family:'Barlow',sans-serif; font-weight:600; font-size:11px; text-transform:none; letter-spacing:0; color:var(--muted); }
  .qc-req { color:var(--gold); }

  .qc-field { display:flex; flex-direction:column; gap:6px; }
  .qc-input {
    width:100%; box-sizing:border-box; padding:11px 13px; min-height:46px;
    font-size:15px; font-family:'Barlow',sans-serif; background:var(--sunken); color:var(--text);
    border:1px solid var(--border); border-radius:8px; appearance:none; -webkit-appearance:none; transition:border-color .12s;
  }
  .qc-input:focus { outline:none; border-color:var(--gold); box-shadow:0 0 0 3px rgba(246,195,36,0.18); }
  .qc-input-sm { max-width:200px; }
  .qc-textarea { min-height:74px; resize:vertical; line-height:1.5; }

  /* Choice grids */
  .qc-grid { display:grid; gap:9px; }
  .qc-grid-reps { grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); }
  .qc-grid-2 { grid-template-columns:1fr 1fr; }
  .qc-choice {
    display:flex; flex-direction:column; align-items:flex-start; gap:3px;
    padding:12px 14px; min-height:56px; background:var(--sunken); color:var(--text);
    border:1px solid var(--border); border-radius:10px; cursor:pointer; text-align:left; transition:.12s;
  }
  .qc-choice:hover { border-color:var(--gold); }
  .qc-choice.is-active { background:var(--gold); border-color:var(--gold); color:var(--sel-fg); box-shadow:0 2px 10px rgba(246,195,36,0.25); }
  .qc-choice-wide { min-height:52px; justify-content:center; }
  .qc-choice-code { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; line-height:1; letter-spacing:0.02em; }
  .qc-choice-name { font-family:'Barlow',sans-serif; font-weight:600; font-size:14px; line-height:1.2; }
  .qc-choice.is-active .qc-choice-code, .qc-choice.is-active .qc-choice-name { color:var(--sel-fg); }

  /* Stepper */
  .qc-stepper { display:flex; align-items:center; gap:14px; }
  .qc-step-btn {
    width:54px; height:54px; flex-shrink:0; background:var(--sunken); color:var(--gold);
    border:1px solid var(--border); border-radius:10px; font-size:28px; line-height:1; cursor:pointer; transition:.12s;
  }
  .qc-step-btn:hover { border-color:var(--gold); }
  .qc-step-value { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:32px; min-width:44px; text-align:center; color:var(--text); }

  /* Buttons / error */
  .qc-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:13px 22px; min-height:52px;
    border-radius:9px; border:1px solid transparent; cursor:pointer;
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:15px; text-transform:uppercase; letter-spacing:0.06em; transition:.12s;
  }
  .qc-btn-primary { background:var(--gold); color:var(--sel-fg); }
  .qc-btn-primary:hover:not(:disabled) { background:var(--gold-h); }
  .qc-btn-ghost { background:transparent; color:var(--muted); border-color:var(--border); }
  .qc-btn-ghost:hover { color:var(--text); border-color:var(--gold); }
  .qc-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .qc-submit { margin-top:14px; width:100%; }
  .qc-error {
    background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-bd);
    border-radius:8px; padding:11px 14px; font-size:14px; margin-top:4px;
  }

  /* Success */
  .qc-thanks { max-width:460px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:32px 22px; gap:6px; }
  .qc-check { width:64px; height:64px; border-radius:50%; background:var(--gold); color:var(--sel-fg); font-size:34px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; }
  .qc-thanks h1 { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:30px; text-transform:uppercase; color:var(--text); }
  .qc-thanks-ref { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; color:var(--gold); letter-spacing:0.04em; }
  .qc-thanks-sub { font-size:15px; color:var(--muted); max-width:340px; }
  .qc-thanks-btns { margin-top:22px; width:100%; max-width:320px; display:flex; flex-direction:column; gap:10px; }
  .qc-thanks-btns .qc-btn { width:100%; }
  .qc-help-link { margin-top:18px; color:var(--muted); font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.06em; text-decoration:none; border-bottom:1px solid var(--border); padding-bottom:2px; }
  .qc-help-link:hover { color:var(--gold); border-color:var(--gold); }

  @media (max-width:640px) {
    .qc-header { padding:11px 14px; padding-top:calc(11px + env(safe-area-inset-top)); gap:8px; }
    .qc-brand-name { font-size:18px; }
    .qc-brand-sub { font-size:10px; }
    .qc-disc { width:30px; height:30px; }
    .qc-theme-toggle { padding:2px; gap:2px; }
    .qc-theme-btn { padding:9px 9px; font-size:10px; letter-spacing:0.03em; min-height:38px; }
    .qc-body { padding:16px 14px calc(40px + env(safe-area-inset-bottom)); }
    .qc-topbar { padding:12px 14px; gap:12px; }
    .qc-grid-2 { grid-template-columns:1fr; }
    .qc-input-sm { max-width:none; flex:1; }
    input, select, textarea, .qc-btn { font-size:16px; }
  }
`;
