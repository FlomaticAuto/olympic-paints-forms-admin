'use client';
import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { LEAD_STATUSES, VISIT_OUTCOMES } from '@/lib/resinCrm/types';
import ResinLeadsListView from '@/components/resin-leads/ResinLeadsListView';
import ResinVisitsListView from '@/components/resin-leads/ResinVisitsListView';
import ResinIntelView from '@/components/resin-leads/ResinIntelView';
import ResinEstimateView from '@/components/resin-leads/ResinEstimateView';

type Distance = 'Local' | 'Long Distance';
type Theme = 'theme-dark' | 'theme-light' | 'theme-navy';
const THEME_KEY = 'rl-theme';
const REP_KEY   = 'rl-rep';

const REPS = ['Kim Williams'];
const LEAD_SOURCES = ['Cold Call', 'Referral', 'Website', 'Trade Show / Expo', 'Existing Customer', 'Email Campaign', 'Walk-in', 'Social Media', 'Other'];
const DISTANCES: Distance[] = ['Local', 'Long Distance'];
const PROVINCES = ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];

interface Lead {
  id: string;
  lead_ref: string;
  company: string;
  contact_person: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  lead_source: string | null;
  lead_status: string | null;
  distance: Distance;
  street: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  rep: string | null;
  notes: string | null;
}

interface Product {
  id: string;
  code: string | null;
  name: string;
  local_price: number | null;
  long_price: number | null;
  category: string | null;
}
interface Supplier { id: string; name: string; }
interface PriceStat { supplier: string; product: string; last: number; avg: number; count: number; }

interface LineItem {
  product_id: string;
  code: string;
  name: string;
  our_price: string;
  est_qty: string;
  order_every: string;
  order_unit: 'Weeks' | 'Months';
  supplier: string;
  supplier_price: string;
  notes: string;
}
function blankItem(): LineItem {
  return {
    product_id: '', code: '', name: '', our_price: '', est_qty: '',
    order_every: '', order_unit: 'Months', supplier: '', supplier_price: '', notes: '',
  };
}

const BLANK_LEAD = {
  company: '', contact_person: '', phone: '', mobile: '', email: '',
  lead_source: '', lead_status: 'New', distance: 'Local' as Distance,
  street: '', city: '', province: '', postal_code: '', notes: '',
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtR(n: number): string { return 'R' + n.toFixed(2); }

// iOS renders a comma on the decimal keypad for South African / most non-US locales,
// but numeric parsing downstream (Number()) only accepts a period.
function normalizeDecimal(raw: string): string { return raw.replace(',', '.'); }

export default function ResinLeadForm() {
  const [theme, setThemeState] = useState<Theme>('theme-light');
  const [rep, setRepState] = useState('Kim Williams');
  const [mode, setMode] = useState<'capture' | 'visit' | 'leads' | 'visits' | 'intel' | 'estimate'>('capture');

  useEffect(() => {
    const t = window.localStorage.getItem(THEME_KEY);
    if (t === 'theme-dark' || t === 'theme-light' || t === 'theme-navy') setThemeState(t);
    const r = window.localStorage.getItem(REP_KEY);
    if (r) setRepState(r);
    // Register the PWA service worker (scoped to /resin-leads) so the form
    // installs as a standalone phone app and opens instantly / offline.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/resin-sw.js', { scope: '/resin-leads' }).catch(() => {});
    }
  }, []);

  // Load the product catalogue, supplier database, and competitor-price index.
  const loadRefData = useCallback(() => {
    fetch('/api/resin-leads/products').then(r => r.json())
      .then(d => setCatalogue(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/resin-leads/suppliers').then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/resin-leads/supplier-price-index').then(r => r.json())
      .then(d => setPriceIndex(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  useEffect(() => { loadRefData(); }, [loadRefData]);
  const setTheme = (t: Theme) => { setThemeState(t); window.localStorage.setItem(THEME_KEY, t); };
  const setRep   = (r: string) => { setRepState(r); window.localStorage.setItem(REP_KEY, r); };

  // ── Capture mode ──────────────────────────────────────────────────────────
  const [cap, setCap] = useState({ ...BLANK_LEAD });
  const setC = (k: keyof typeof BLANK_LEAD, v: string) => setCap(p => ({ ...p, [k]: v }));

  // ── Visit mode ────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const [visitDate, setVisitDate] = useState(todayLocal);
  const [outcome, setOutcome] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([blankItem()]);

  // Product catalogue + supplier database (loaded from Supabase)
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [priceIndex, setPriceIndex] = useState<PriceStat[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [np, setNp] = useState({ name: '', code: '', category: 'Solvent/Thinner', local_price: '', long_price: '' });
  const [savingProduct, setSavingProduct] = useState(false);

  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Submit / result ───────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneRef, setDoneRef] = useState<{ kind: 'lead' | 'visit'; ref: string; name: string } | null>(null);

  // ── Search (debounced) ──────────────────────────────────────────────────
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchLeads = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.trim().length < 2) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/resin-leads/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  function selectLead(l: Lead) {
    setLead(l);
    setQuery(l.company);
    setResults([]);
    setOutcome('');
    setNextFollowUp('');
    setVisitNotes('');
    setItems([blankItem()]);
    setPhotoPreviews([]); setPhotoUrls([]);
    setError(null);
  }

  function clearLead() {
    setLead(null); setQuery(''); setResults([]);
  }

  // ── Line items ────────────────────────────────────────────────────────────
  const distance: Distance = lead?.distance ?? 'Local';
  function catalogPrice(p: Product | undefined, dist: Distance): number | null {
    if (!p) return null;
    return dist === 'Long Distance' ? p.long_price : p.local_price;
  }
  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function selectProduct(i: number, product_id: string) {
    // Never auto-fill the price — the rep always types the confirmed value.
    // The catalogue list price is shown only as a reference hint.
    const p = catalogue.find(x => x.id === product_id);
    updateItem(i, { product_id, name: p?.name ?? '', code: p?.code ?? '' });
  }
  function supplierHint(supplier: string, productName: string): PriceStat | null {
    const s = supplier.trim().toLowerCase();
    const p = productName.trim().toLowerCase();
    if (!s || !p) return null;
    return priceIndex.find(x => x.supplier.toLowerCase() === s && x.product.toLowerCase() === p) ?? null;
  }
  function addItem() { setItems(prev => [...prev, blankItem()]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function lineEstValue(it: LineItem): number {
    return (Number(it.our_price) || 0) * (Number(it.est_qty) || 0);
  }
  const grandTotal = items.reduce((s, it) => s + lineEstValue(it), 0);

  async function saveNewProduct() {
    if (!np.name.trim()) return;
    setSavingProduct(true);
    try {
      const res = await fetch('/api/resin-leads/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: np.name.trim(), code: np.code.trim() || null, category: np.category,
          local_price: np.local_price || null, long_price: np.long_price || null,
        }),
      });
      const p = await res.json();
      if (res.ok && p.id) {
        setCatalogue(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]));
        setNp({ name: '', code: '', category: 'Solvent/Thinner', local_price: '', long_price: '' });
        setShowAddProduct(false);
      }
    } catch { /* non-fatal */ }
    finally { setSavingProduct(false); }
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !lead) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      setPhotoPreviews(p => [...p, preview]);
      setPhotoUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('key', 'visit');
        fd.append('ref', lead.lead_ref);
        const res = await fetch('/api/resin-leads/upload-photo', { method: 'POST', body: fd });
        const j = await res.json();
        if (res.ok && j.url) setPhotoUrls(p => [...p, j.url]);
      } catch { /* non-fatal */ }
      finally { setPhotoUploading(false); }
    }
    e.target.value = '';
  }
  function removePhoto(i: number) {
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i));
    setPhotoUrls(p => p.filter((_, idx) => idx !== i));
  }

  // ── Submit: create lead ─────────────────────────────────────────────────
  async function submitLead() {
    if (!cap.company.trim()) { setError('Company name is required.'); return; }
    if (!rep) { setError('Select who is capturing this lead (top right).'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/resin-leads/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...cap, rep }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Save failed.'); setBusy(false); return; }
      setDoneRef({ kind: 'lead', ref: j.lead_ref, name: cap.company.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error'); setBusy(false);
    }
  }

  // ── Submit: log visit ───────────────────────────────────────────────────
  async function submitVisit() {
    if (!lead) { setError('Select a lead first.'); return; }
    if (!rep) { setError('Select who is logging this visit (top right).'); return; }
    if (!visitDate) { setError('Visit date is required.'); return; }
    setBusy(true); setError(null);
    const products = items
      .filter(it => it.product_id || it.name.trim())
      .map(it => ({
        product_id: it.product_id || null,
        code: it.code || null,
        name: it.name,
        our_price: it.our_price !== '' ? Number(it.our_price) : null,
        est_qty: it.est_qty !== '' ? Number(it.est_qty) : null,
        order_every: it.order_every !== '' ? Number(it.order_every) : null,
        order_unit: it.order_unit || null,
        current_supplier: it.supplier.trim() || null,
        current_supplier_price: it.supplier_price !== '' ? Number(it.supplier_price) : null,
        notes: it.notes.trim() || null,
      }));
    try {
      const res = await fetch('/api/resin-leads/visit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, lead_ref: lead.lead_ref, company: lead.company,
          rep, visit_date: visitDate, distance: lead.distance,
          outcome: outcome || null, next_follow_up: nextFollowUp || null,
          notes: visitNotes || null, photos: photoUrls, products,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Save failed.'); setBusy(false); return; }
      setDoneRef({ kind: 'visit', ref: j.visit_ref, name: lead.company });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error'); setBusy(false);
    }
  }

  function resetAll() {
    setDoneRef(null); setBusy(false); setError(null);
    setCap({ ...BLANK_LEAD });
    clearLead(); setVisitDate(todayLocal()); setOutcome(''); setNextFollowUp('');
    setVisitNotes(''); setItems([blankItem()]); setShowAddProduct(false);
    setPhotoPreviews([]); setPhotoUrls([]);
    loadRefData();   // pick up any suppliers/prices captured this session
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (doneRef) {
    return (
      <main className={`rl-wrap ${theme}`}>
        <div className="rl-thanks">
          <img src="/olympic-resins-logo.svg" alt="Olympic Resins" className="rl-thanks-logo" />
          <div className="rl-check">✓</div>
          <h1>{doneRef.kind === 'lead' ? 'Lead Captured' : 'Visit Logged'}</h1>
          <p className="rl-thanks-ref">{doneRef.ref}</p>
          <p className="rl-thanks-sub">
            {doneRef.kind === 'lead'
              ? <>New lead <strong>{doneRef.name}</strong> is now searchable in Log Visit.</>
              : <>Visit for <strong>{doneRef.name}</strong> has been recorded.</>}
          </p>
          <div className="rl-thanks-btns">
            <button className="rl-btn rl-btn-primary" onClick={resetAll}>
              {doneRef.kind === 'lead' ? 'Capture Another Lead' : 'Log Another Visit'}
            </button>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <main className={`rl-wrap ${theme}`}>
      <div className="rl-shell">

        {/* Header */}
        <header className="rl-header">
          <div className="rl-brand">
            <span className="rl-disc" aria-hidden="true" />
            <div className="rl-brand-text">
              <span className="rl-brand-name">Olympic Resins</span>
              <span className="rl-brand-sub">Lead Manager</span>
            </div>
          </div>
          <div className="rl-theme-toggle" role="group" aria-label="Display theme">
            {(['theme-dark', 'theme-light', 'theme-navy'] as Theme[]).map(t => (
              <button key={t} type="button"
                className={`rl-theme-btn${theme === t ? ' is-active' : ''}`}
                onClick={() => setTheme(t)}>
                {t === 'theme-dark' ? 'Dark' : t === 'theme-light' ? 'Light' : 'Navy'}
              </button>
            ))}
          </div>
        </header>

        {/* Rep + mode toggle */}
        <div className="rl-topbar">
          <div className="rl-rep-field">
            <label className="rl-mini-label">Rep</label>
            <select className="rl-input rl-input-sm" value={rep} onChange={e => setRep(e.target.value)}>
              {REPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="rl-mode-toggle" role="group">
            <button type="button" className={`rl-mode-btn${mode === 'capture' ? ' is-active' : ''}`}
              onClick={() => { setMode('capture'); setError(null); }}>Capture Lead</button>
            <button type="button" className={`rl-mode-btn${mode === 'visit' ? ' is-active' : ''}`}
              onClick={() => { setMode('visit'); setError(null); }}>Log Visit</button>
            <button type="button" className={`rl-mode-btn${mode === 'leads' ? ' is-active' : ''}`}
              onClick={() => { setMode('leads'); setError(null); }}>Leads</button>
            <button type="button" className={`rl-mode-btn${mode === 'visits' ? ' is-active' : ''}`}
              onClick={() => { setMode('visits'); setError(null); }}>Visits</button>
            <button type="button" className={`rl-mode-btn${mode === 'intel' ? ' is-active' : ''}`}
              onClick={() => { setMode('intel'); setError(null); }}>Intel</button>
            <button type="button" className={`rl-mode-btn${mode === 'estimate' ? ' is-active' : ''}`}
              onClick={() => { setMode('estimate'); setError(null); }}>Estimate</button>
          </div>
        </div>

        {/* Body */}
        <div className="rl-body">

          {/* ── CAPTURE LEAD ── */}
          {mode === 'capture' && (
            <div className="rl-form">
              <div className="rl-section-title">Company</div>
              <div className="rl-field">
                <label className="rl-label">Company Name <span className="rl-req">*</span></label>
                <input className="rl-input" value={cap.company} onChange={e => setC('company', e.target.value)}
                  placeholder="e.g. Acme Coatings (Pty) Ltd" autoComplete="off" />
              </div>
              <div className="rl-row-2">
                <div className="rl-field">
                  <label className="rl-label">Lead Source</label>
                  <select className="rl-input" value={cap.lead_source} onChange={e => setC('lead_source', e.target.value)}>
                    <option value="">— Select —</option>
                    {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="rl-field">
                  <label className="rl-label">Lead Status</label>
                  <select className="rl-input" value={cap.lead_status} onChange={e => setC('lead_status', e.target.value)}>
                    {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="rl-field">
                <label className="rl-label">Delivery Distance <span className="rl-req">*</span></label>
                <div className="rl-seg">
                  {DISTANCES.map(d => (
                    <button key={d} type="button" className={`rl-seg-btn${cap.distance === d ? ' is-active' : ''}`}
                      onClick={() => setC('distance', d)}>{d}</button>
                  ))}
                </div>
                <p className="rl-hint">Sets which price column applies when quoting this lead.</p>
              </div>

              <div className="rl-section-title">Contact</div>
              <div className="rl-field">
                <label className="rl-label">Contact Person</label>
                <input className="rl-input" value={cap.contact_person} onChange={e => setC('contact_person', e.target.value)}
                  placeholder="Full name" autoComplete="off" />
              </div>
              <div className="rl-row-2">
                <div className="rl-field">
                  <label className="rl-label">Phone</label>
                  <input className="rl-input" type="tel" value={cap.phone} onChange={e => setC('phone', e.target.value)} autoComplete="off" />
                </div>
                <div className="rl-field">
                  <label className="rl-label">Mobile</label>
                  <input className="rl-input" type="tel" value={cap.mobile} onChange={e => setC('mobile', e.target.value)} autoComplete="off" />
                </div>
              </div>
              <div className="rl-field">
                <label className="rl-label">Email</label>
                <input className="rl-input" type="email" value={cap.email} onChange={e => setC('email', e.target.value)} autoComplete="off" />
              </div>

              <div className="rl-section-title">Address</div>
              <div className="rl-field">
                <label className="rl-label">Street</label>
                <input className="rl-input" value={cap.street} onChange={e => setC('street', e.target.value)} autoComplete="off" />
              </div>
              <div className="rl-row-3">
                <div className="rl-field">
                  <label className="rl-label">City / Town</label>
                  <input className="rl-input" value={cap.city} onChange={e => setC('city', e.target.value)} autoComplete="off" />
                </div>
                <div className="rl-field">
                  <label className="rl-label">Province</label>
                  <select className="rl-input" value={cap.province} onChange={e => setC('province', e.target.value)}>
                    <option value="">— Select —</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="rl-field">
                  <label className="rl-label">Postal Code</label>
                  <input className="rl-input" value={cap.postal_code} onChange={e => setC('postal_code', e.target.value)} autoComplete="off" />
                </div>
              </div>

              <div className="rl-section-title">Notes</div>
              <div className="rl-field">
                <textarea className="rl-input rl-textarea" value={cap.notes} onChange={e => setC('notes', e.target.value)}
                  placeholder="Requirements, current supplier, volumes, anything worth remembering…" />
              </div>

              {error && <p className="rl-error">{error}</p>}
              <button className="rl-btn rl-btn-primary rl-submit" onClick={submitLead} disabled={busy}>
                {busy ? 'Saving…' : 'Save Lead'}
              </button>
            </div>
          )}

          {/* ── LOG VISIT ── */}
          {mode === 'visit' && (
            <div className="rl-form">
              <div className="rl-section-title">Find Lead</div>
              {!lead ? (
                <div className="rl-field rl-search-field">
                  <label className="rl-label">Search by company, contact, phone, city or ref</label>
                  <input className="rl-input" value={query} autoComplete="off"
                    placeholder="Type at least 2 characters…"
                    onChange={e => { setQuery(e.target.value); searchLeads(e.target.value); }} />
                  {searching && <p className="rl-hint">Searching…</p>}
                  {!searching && results.length > 0 && (
                    <ul className="rl-search-list">
                      {results.map(l => (
                        <li key={l.id} className="rl-search-item" onClick={() => selectLead(l)}>
                          <span className="rl-search-name">{l.company}</span>
                          {l.contact_person && <span className="rl-search-meta">{l.contact_person}</span>}
                          {l.city && <span className="rl-search-meta">{l.city}</span>}
                          <span className="rl-search-meta">{l.lead_ref}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searching && query.trim().length >= 2 && results.length === 0 && (
                    <p className="rl-hint">No leads found. Capture it first via <strong>Capture Lead</strong>.</p>
                  )}
                </div>
              ) : (
                <div className="rl-lead-card">
                  <div className="rl-lead-card-top">
                    <span className="rl-lead-company">{lead.company}</span>
                    <span className={`rl-pill rl-pill-${lead.distance === 'Local' ? 'local' : 'long'}`}>{lead.distance}</span>
                  </div>
                  <div className="rl-lead-grid">
                    {lead.contact_person && <div><span className="rl-lc-l">Contact</span><span className="rl-lc-v">{lead.contact_person}</span></div>}
                    {lead.phone   && <div><span className="rl-lc-l">Phone</span><span className="rl-lc-v">{lead.phone}</span></div>}
                    {lead.mobile  && <div><span className="rl-lc-l">Mobile</span><span className="rl-lc-v">{lead.mobile}</span></div>}
                    {lead.email   && <div><span className="rl-lc-l">Email</span><span className="rl-lc-v">{lead.email}</span></div>}
                    {lead.city    && <div><span className="rl-lc-l">City</span><span className="rl-lc-v">{lead.city}{lead.province ? `, ${lead.province}` : ''}</span></div>}
                    {lead.lead_status && <div><span className="rl-lc-l">Status</span><span className="rl-lc-v">{lead.lead_status}</span></div>}
                    <div><span className="rl-lc-l">Ref</span><span className="rl-lc-v">{lead.lead_ref}</span></div>
                  </div>
                  <button type="button" className="rl-clear-btn" onClick={clearLead}>Change Lead</button>
                </div>
              )}

              {lead && (
                <>
                  <div className="rl-section-title">Visit</div>
                  <div className="rl-row-2">
                    <div className="rl-field">
                      <label className="rl-label">Visit Date <span className="rl-req">*</span></label>
                      <input className="rl-input" type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} />
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">Outcome / Stage</label>
                      <select className="rl-input" value={outcome} onChange={e => setOutcome(e.target.value)}>
                        <option value="">— Select —</option>
                        {VISIT_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="rl-section-title">
                    Products of Interest
                    <span className="rl-section-note">Prices auto-fill {distance} · editable</span>
                  </div>
                  <div className="rl-items">
                    {items.map((it, i) => {
                      const listPrice = catalogPrice(catalogue.find(x => x.id === it.product_id), distance);
                      const hint = supplierHint(it.supplier, it.name);
                      return (
                      <div key={i} className="rl-item-card">
                        <div className="rl-item-card-head">
                          <select className="rl-input rl-item-product" value={it.product_id}
                            onChange={e => selectProduct(i, e.target.value)}>
                            <option value="">— Select product —</option>
                            {catalogue.map(p => (
                              <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ''}{p.name}</option>
                            ))}
                          </select>
                          <button type="button" className="rl-item-del" onClick={() => removeItem(i)}
                            aria-label="Remove product" disabled={items.length === 1}>×</button>
                        </div>
                        <div className="rl-item-grid">
                          <div className="rl-field">
                            <label className="rl-label">Our Price (R)</label>
                            <input className="rl-input" type="text" inputMode="decimal"
                              placeholder="Type price" value={it.our_price}
                              onChange={e => updateItem(i, { our_price: normalizeDecimal(e.target.value) })} />
                            {listPrice != null && <p className="rl-ref">List ref: {fmtR(listPrice)}</p>}
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Est. Qty (kg)</label>
                            <input className="rl-input" type="text" inputMode="decimal"
                              placeholder="0" value={it.est_qty}
                              onChange={e => updateItem(i, { est_qty: normalizeDecimal(e.target.value) })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Order Every</label>
                            <div className="rl-period">
                              <input className="rl-input rl-period-n" type="number" inputMode="numeric" min="0"
                                placeholder="0" value={it.order_every}
                                onChange={e => updateItem(i, { order_every: e.target.value })} />
                              <select className="rl-input rl-period-u" value={it.order_unit}
                                onChange={e => updateItem(i, { order_unit: e.target.value as 'Weeks' | 'Months' })}>
                                <option value="Weeks">Weeks</option>
                                <option value="Months">Months</option>
                              </select>
                            </div>
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Current Supplier</label>
                            <input className="rl-input" list="rl-suppliers" autoComplete="off"
                              placeholder="Who supplies them now" value={it.supplier}
                              onChange={e => updateItem(i, { supplier: e.target.value })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Their Price (R)</label>
                            <input className="rl-input" type="text" inputMode="decimal"
                              placeholder="Type price" value={it.supplier_price}
                              onChange={e => updateItem(i, { supplier_price: normalizeDecimal(e.target.value) })} />
                            {hint && <p className="rl-ref">Last {fmtR(hint.last)} · Avg {fmtR(hint.avg)} · {hint.count}×</p>}
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Est. Value</label>
                            <div className="rl-item-value-v">{fmtR(lineEstValue(it))}</div>
                          </div>
                        </div>
                        <div className="rl-field">
                          <label className="rl-label">Comments</label>
                          <textarea className="rl-input rl-item-notes" rows={2}
                            placeholder="Notes on this product…" value={it.notes}
                            onChange={e => updateItem(i, { notes: e.target.value })} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  <datalist id="rl-suppliers">
                    {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                  <div className="rl-items-foot">
                    <div className="rl-items-foot-btns">
                      <button type="button" className="rl-add-btn" onClick={addItem}>+ Add product line</button>
                      <button type="button" className="rl-add-btn rl-add-btn-alt" onClick={() => setShowAddProduct(v => !v)}>
                        + New product to catalogue
                      </button>
                    </div>
                    <div className="rl-grand">
                      <span className="rl-grand-l">Est. Value</span>
                      <span className="rl-grand-v">{fmtR(grandTotal)}</span>
                    </div>
                  </div>

                  {showAddProduct && (
                    <div className="rl-addprod">
                      <div className="rl-addprod-title">New Product</div>
                      <div className="rl-row-2">
                        <div className="rl-field">
                          <label className="rl-label">Name <span className="rl-req">*</span></label>
                          <input className="rl-input" value={np.name} placeholder="Product name" autoComplete="off"
                            onChange={e => setNp(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="rl-field">
                          <label className="rl-label">Code</label>
                          <input className="rl-input" value={np.code} placeholder="Optional" autoComplete="off"
                            onChange={e => setNp(p => ({ ...p, code: e.target.value }))} />
                        </div>
                      </div>
                      <div className="rl-row-3">
                        <div className="rl-field">
                          <label className="rl-label">Category</label>
                          <select className="rl-input" value={np.category}
                            onChange={e => setNp(p => ({ ...p, category: e.target.value }))}>
                            <option>Resin</option>
                            <option>Solvent/Thinner</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div className="rl-field">
                          <label className="rl-label">Local Price</label>
                          <input className="rl-input" type="text" inputMode="decimal" value={np.local_price} placeholder="Optional"
                            onChange={e => setNp(p => ({ ...p, local_price: normalizeDecimal(e.target.value) }))} />
                        </div>
                        <div className="rl-field">
                          <label className="rl-label">Long Dist. Price</label>
                          <input className="rl-input" type="text" inputMode="decimal" value={np.long_price} placeholder="Optional"
                            onChange={e => setNp(p => ({ ...p, long_price: normalizeDecimal(e.target.value) }))} />
                        </div>
                      </div>
                      <div className="rl-addprod-btns">
                        <button type="button" className="rl-btn rl-btn-primary rl-btn-sm"
                          onClick={saveNewProduct} disabled={savingProduct || !np.name.trim()}>
                          {savingProduct ? 'Saving…' : 'Save Product'}
                        </button>
                        <button type="button" className="rl-clear-btn" onClick={() => setShowAddProduct(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="rl-section-title">Follow-up & Notes</div>
                  <div className="rl-field">
                    <label className="rl-label">Next Follow-up Date</label>
                    <input className="rl-input rl-input-sm" type="date" value={nextFollowUp} onChange={e => setNextFollowUp(e.target.value)} />
                  </div>
                  <div className="rl-field">
                    <label className="rl-label">Visit Notes</label>
                    <textarea className="rl-input rl-textarea" value={visitNotes} onChange={e => setVisitNotes(e.target.value)}
                      placeholder="What was discussed, next steps, objections…" />
                  </div>

                  <div className="rl-section-title">Photos</div>
                  <div className="rl-photo-row">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="rl-photo-thumb">
                        <img src={src} alt={`Photo ${i + 1}`} />
                        <button type="button" className="rl-photo-remove" onClick={() => removePhoto(i)} aria-label="Remove photo">×</button>
                      </div>
                    ))}
                    <div className="rl-photo-add" onClick={() => photoInputRef.current?.click()}>
                      {photoUploading ? <span className="rl-photo-up">↑</span> : <><span className="rl-photo-ic">📷</span><span>Add</span></>}
                      <input ref={photoInputRef} type="file" accept="image/*" multiple capture="environment"
                        style={{ display: 'none' }} onChange={handlePhoto} />
                    </div>
                  </div>

                  {error && <p className="rl-error">{error}</p>}
                  <button className="rl-btn rl-btn-primary rl-submit" onClick={submitVisit} disabled={busy}>
                    {busy ? 'Saving…' : 'Save Visit'}
                  </button>
                </>
              )}

              {!lead && error && <p className="rl-error">{error}</p>}
            </div>
          )}

          {/* ── LEADS LOADED ── */}
          {mode === 'leads' && <ResinLeadsListView />}

          {/* ── LEADS VISITED ── */}
          {mode === 'visits' && <ResinVisitsListView />}

          {/* ── ASSESSMENT & INTEL ── */}
          {mode === 'intel' && <ResinIntelView />}

          {/* ── ESTIMATE ── */}
          {mode === 'estimate' && <ResinEstimateView rep={rep} />}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  .rl-wrap.theme-dark {
    --p:#0D0D0B; --base:#1A1A18; --elev:#2E2E2C; --sunken:#0D0D0B;
    --gold:#F6C324; --gold-h:#FAE04D; --text:#E8E7E2; --muted:#949390; --dim:#5C5B58;
    --border:rgba(255,255,255,0.10); --border-s:rgba(255,255,255,0.06);
    --sel-bg:#F6C324; --sel-fg:#0D0D0B; --focus:#F6C324;
    --danger-bg:rgba(232,96,96,0.12); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.30);
    --info-bg:rgba(26,61,110,0.30); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.30);
    --section-bg:rgba(246,195,36,0.06);
    background:var(--p); color:var(--text);
  }
  .rl-wrap.theme-light {
    --p:#F7F6F3; --base:#FFFFFF; --elev:#FFFFFF; --sunken:#F0EFEA;
    --gold:#E6A700; --gold-h:#C88F00; --text:#0D0D0B; --muted:#5C5B58; --dim:#949390;
    --border:#C8C7C0; --border-s:#E8E7E2;
    --sel-bg:#F6C324; --sel-fg:#0D0D0B; --focus:#1A3D6E;
    --danger-bg:#FEF2F2; --danger-fg:#C0392B; --danger-bd:#E86060;
    --info-bg:#F0EFEA; --info-fg:#2E2E2C; --info-bd:#C8C7C0;
    --section-bg:rgba(246,195,36,0.10);
    background:var(--p); color:var(--text);
  }
  .rl-wrap.theme-navy {
    --p:#071022; --base:#0D2040; --elev:#1A3D6E; --sunken:#071022;
    --gold:#F6C324; --gold-h:#FAE04D; --text:#FFFFFF; --muted:#B8CCE8; --dim:#6B9ED0;
    --border:rgba(107,158,208,0.20); --border-s:rgba(107,158,208,0.12);
    --sel-bg:#F6C324; --sel-fg:#071022; --focus:#F6C324;
    --danger-bg:rgba(232,96,96,0.14); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.35);
    --info-bg:rgba(45,107,168,0.20); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.35);
    --section-bg:rgba(107,158,208,0.08);
    background:var(--p); color:var(--text);
  }

  .rl-wrap { min-height:100vh; margin:0; padding:0; font-family:'Barlow',sans-serif; -webkit-tap-highlight-color:rgba(0,0,0,0); -webkit-text-size-adjust:100%; overscroll-behavior-y:contain; }
  .rl-shell { max-width:860px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; background:var(--base); }

  /* Header */
  .rl-header {
    display:flex; align-items:center; gap:12px;
    padding:12px 18px; background:var(--base);
    border-bottom:1px solid var(--border); position:sticky; top:0; z-index:50;
    padding-top:calc(12px + env(safe-area-inset-top));
  }
  .rl-brand { display:flex; align-items:center; gap:11px; }
  .rl-disc { width:34px; height:34px; border-radius:50%; background:var(--gold); flex-shrink:0; box-shadow:0 2px 8px rgba(246,195,36,0.25); }
  .rl-brand-text { display:flex; flex-direction:column; line-height:1; }
  .rl-brand-name { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; text-transform:uppercase; letter-spacing:0.02em; color:var(--text); }
  .rl-brand-sub { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.14em; color:var(--gold); margin-top:2px; }
  .rl-theme-toggle { display:flex; gap:3px; background:var(--sunken); border-radius:8px; padding:3px; margin-left:auto; }
  .rl-theme-btn {
    background:transparent; border:0; color:var(--muted); border-radius:6px; padding:8px 13px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer; min-height:36px; transition:.12s;
  }
  .rl-theme-btn:hover { background:var(--elev); color:var(--text); }
  .rl-theme-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); font-weight:900; }

  /* Topbar: rep + mode */
  .rl-topbar {
    display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap;
    padding:14px 18px; background:var(--sunken); border-bottom:1px solid var(--border);
  }
  .rl-rep-field { display:flex; flex-direction:column; gap:5px; }
  .rl-mini-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.12em; color:var(--dim); }
  .rl-mode-toggle { display:flex; gap:4px; background:var(--base); border:1px solid var(--border); border-radius:10px; padding:4px; margin-left:auto; overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .rl-mode-btn {
    flex:0 0 auto; white-space:nowrap;
    padding:10px 18px; min-height:44px; background:transparent; border:0; color:var(--muted); border-radius:7px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px;
    text-transform:uppercase; letter-spacing:0.06em; cursor:pointer; transition:.12s;
  }
  .rl-mode-btn:hover { color:var(--text); }
  .rl-mode-btn.is-active { background:var(--gold); color:var(--sel-fg); font-weight:900; }

  /* Body / form */
  .rl-body { padding:18px 18px calc(40px + env(safe-area-inset-bottom)); flex:1; }
  .rl-form { display:flex; flex-direction:column; gap:13px; }
  .rl-section-title {
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:15px;
    text-transform:uppercase; letter-spacing:0.04em; color:var(--gold);
    border-bottom:1px solid var(--border); padding-bottom:7px; margin-top:8px;
    display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  }
  .rl-section-title:first-child { margin-top:0; }
  .rl-section-note { font-family:'Barlow',sans-serif; font-weight:600; font-size:11px; text-transform:none; letter-spacing:0; color:var(--muted); }

  .rl-field { display:flex; flex-direction:column; gap:6px; }
  .rl-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
  .rl-req { color:var(--gold); }
  .rl-hint { margin:2px 0 0; font-size:12px; color:var(--dim); }
  .rl-ref { margin:4px 0 0; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; letter-spacing:0.03em; color:var(--muted); text-transform:uppercase; }
  .rl-input {
    width:100%; box-sizing:border-box; padding:11px 13px; min-height:46px;
    font-size:15px; font-family:'Barlow',sans-serif; background:var(--sunken); color:var(--text);
    border:1px solid var(--border); border-radius:8px; appearance:none; -webkit-appearance:none; transition:border-color .12s;
  }
  .rl-input:focus { outline:none; border-color:var(--gold); box-shadow:0 0 0 3px rgba(246,195,36,0.18); }
  .rl-input-sm { max-width:220px; }
  .rl-textarea { min-height:82px; resize:vertical; line-height:1.5; }
  .rl-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .rl-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }

  /* Segmented (distance) */
  .rl-seg { display:flex; gap:4px; background:var(--sunken); border:1px solid var(--border); border-radius:9px; padding:4px; }
  .rl-seg-btn {
    flex:1; padding:10px 14px; min-height:44px; background:transparent; border:0; color:var(--muted); border-radius:6px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; transition:.12s;
  }
  .rl-seg-btn.is-active { background:var(--gold); color:var(--sel-fg); font-weight:900; }

  /* Search */
  .rl-search-field { position:relative; }
  .rl-search-list {
    list-style:none; margin:4px 0 0; padding:0; background:var(--elev); border:1px solid var(--border);
    border-radius:8px; overflow:hidden; position:absolute; left:0; right:0; top:100%; z-index:30; box-shadow:0 6px 20px rgba(0,0,0,0.3);
  }
  .rl-search-item { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--border-s); }
  .rl-search-item:last-child { border-bottom:0; }
  .rl-search-item:hover { background:var(--section-bg); }
  .rl-search-name { font-size:14px; font-weight:600; color:var(--text); }
  .rl-search-meta { font-family:'Barlow Condensed',sans-serif; font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:0.06em; }

  /* Lead card */
  .rl-lead-card { background:var(--info-bg); border:1px solid var(--info-bd); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
  .rl-lead-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .rl-lead-company { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:19px; text-transform:uppercase; color:var(--text); }
  .rl-pill { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; padding:4px 10px; border-radius:50px; white-space:nowrap; }
  .rl-pill-local { background:rgba(45,140,122,0.18); color:#79d4c2; border:1px solid rgba(45,140,122,0.4); }
  .rl-pill-long  { background:rgba(246,195,36,0.16); color:var(--gold); border:1px solid rgba(246,195,36,0.4); }
  .rl-lead-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; }
  .rl-lead-grid > div { display:flex; flex-direction:column; }
  .rl-lc-l { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:var(--dim); }
  .rl-lc-v { font-size:14px; color:var(--info-fg); }
  .rl-clear-btn {
    align-self:flex-start; padding:8px 15px; min-height:38px; background:var(--elev); color:var(--muted);
    border:1px solid var(--border); border-radius:8px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; letter-spacing:0.06em; cursor:pointer;
  }
  .rl-clear-btn:hover { color:var(--text); }

  /* Product interest cards */
  .rl-items { display:flex; flex-direction:column; gap:12px; }
  .rl-item-card { background:var(--section-bg); border:1px solid var(--border); border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:10px; }
  .rl-item-card-head { display:flex; gap:8px; align-items:center; }
  .rl-item-product { flex:1; min-height:46px; font-weight:600; }
  .rl-item-del {
    width:40px; height:46px; flex-shrink:0; background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-bd);
    border-radius:8px; font-size:20px; line-height:1; cursor:pointer;
  }
  .rl-item-del:disabled { opacity:0.3; cursor:not-allowed; }
  .rl-item-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .rl-period { display:flex; gap:6px; }
  .rl-period-n { width:66px; text-align:right; }
  .rl-period-u { flex:1; }
  .rl-item-value-v { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:18px; color:var(--gold); padding-top:9px; }
  .rl-item-notes { min-height:52px; resize:vertical; line-height:1.45; padding-top:9px; }
  .rl-items-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:2px; flex-wrap:wrap; }
  .rl-items-foot-btns { display:flex; gap:8px; flex-wrap:wrap; }
  .rl-add-btn {
    padding:9px 14px; min-height:42px; background:transparent; color:var(--gold); border:1px dashed var(--border);
    border-radius:8px; font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer;
  }
  .rl-add-btn:hover { border-color:var(--gold); }
  .rl-add-btn-alt { color:var(--muted); }
  .rl-add-btn-alt:hover { color:var(--text); }
  .rl-grand { display:flex; align-items:baseline; gap:10px; }
  .rl-grand-l { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); }
  .rl-grand-v { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:22px; color:var(--gold); }
  .rl-addprod { background:var(--info-bg); border:1px solid var(--info-bd); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px; }
  .rl-addprod-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:14px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text); }
  .rl-addprod-btns { display:flex; gap:10px; align-items:center; }
  .rl-btn-sm { padding:9px 18px; min-height:44px; font-size:14px; }

  /* Photos */
  .rl-photo-row { display:flex; flex-wrap:wrap; gap:10px; }
  .rl-photo-thumb { position:relative; width:84px; height:84px; border-radius:8px; overflow:hidden; border:1px solid var(--border); }
  .rl-photo-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .rl-photo-remove { position:absolute; top:3px; right:3px; width:22px; height:22px; border-radius:50%; border:0; background:rgba(0,0,0,0.6); color:#fff; font-size:15px; line-height:1; cursor:pointer; }
  .rl-photo-add {
    width:84px; height:84px; border-radius:8px; border:1px dashed var(--border); background:var(--sunken);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; color:var(--muted);
  }
  .rl-photo-add:hover { border-color:var(--gold); color:var(--gold); }
  .rl-photo-ic { font-size:20px; }
  .rl-photo-up { font-size:22px; color:var(--gold); }

  /* Buttons / error */
  .rl-btn {
    display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:13px 22px; min-height:50px;
    border-radius:9px; border:1px solid transparent; cursor:pointer;
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:15px; text-transform:uppercase; letter-spacing:0.06em; transition:.12s;
  }
  .rl-btn-primary { background:var(--gold); color:var(--sel-fg); }
  .rl-btn-primary:hover:not(:disabled) { background:var(--gold-h); }
  .rl-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .rl-submit { margin-top:12px; width:100%; }
  .rl-error {
    background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-bd);
    border-radius:8px; padding:11px 14px; font-size:14px; margin-top:4px;
  }

  /* Success */
  .rl-thanks { max-width:460px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:32px 22px; gap:6px; }
  .rl-thanks-logo { width:130px; height:auto; margin-bottom:6px; }
  .rl-check { width:64px; height:64px; border-radius:50%; background:var(--gold); color:var(--sel-fg); font-size:34px; display:flex; align-items:center; justify-content:center; margin-bottom:8px; }
  .rl-thanks h1 { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:30px; text-transform:uppercase; color:var(--text); }
  .rl-thanks-ref { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; color:var(--gold); letter-spacing:0.04em; }
  .rl-thanks-sub { font-size:15px; color:var(--muted); max-width:340px; }
  .rl-thanks-btns { margin-top:20px; width:100%; max-width:320px; }
  .rl-thanks-btns .rl-btn { width:100%; }

  /* Generic status/outcome pills (Leads / Visits / Intel views) */
  .rl-pill-success { background:rgba(45,140,122,0.18); color:#79d4c2; border:1px solid rgba(45,140,122,0.4); }
  .rl-pill-warning { background:rgba(246,195,36,0.16); color:var(--gold); border:1px solid rgba(246,195,36,0.4); }
  .rl-pill-danger  { background:var(--danger-bg); color:var(--danger-fg); border:1px solid var(--danger-bd); }
  .rl-pill-info    { background:var(--info-bg); color:var(--info-fg); border:1px solid var(--info-bd); }
  .rl-pill-neutral { background:var(--sunken); color:var(--muted); border:1px solid var(--border); }

  /* Report toolbar (search + filters) shared by Leads / Visits views */
  .rl-report-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .rl-report-count { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); }
  .rl-report-filters { display:flex; gap:8px; flex-wrap:wrap; flex:1; }
  .rl-report-filters .rl-input { min-width:150px; flex:1; }

  /* Empty / loading state */
  .rl-empty { text-align:center; padding:44px 16px; color:var(--muted); }
  .rl-empty-icon { font-size:32px; margin-bottom:10px; }
  .rl-empty-title { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:15px; text-transform:uppercase; color:var(--text); margin-bottom:4px; }
  .rl-empty-body { font-size:13px; color:var(--muted); }

  /* Assessment & Intel: stat strip */
  .rl-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .rl-stat { background:var(--section-bg); border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:2px; }
  .rl-stat-num { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:28px; color:var(--gold); line-height:1; }
  .rl-stat-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }

  /* Assessment & Intel: competitor pricing "Us vs Them" cards */
  .rl-compare-card { background:var(--section-bg); border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .rl-compare-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .rl-compare-supplier { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:16px; text-transform:uppercase; color:var(--text); }
  .rl-compare-product { font-size:14px; color:var(--muted); }
  .rl-compare-nums { display:flex; gap:24px; align-items:baseline; flex-wrap:wrap; }
  .rl-compare-num-l { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--dim); margin-right:6px; }
  .rl-compare-num-v { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px; color:var(--text); }
  .rl-compare-sub { font-size:11px; color:var(--dim); }

  /* Assessment & Intel: competitor footprint cards */
  .rl-footprint-card { background:var(--section-bg); border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:6px; }
  .rl-footprint-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .rl-footprint-supplier { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:16px; text-transform:uppercase; color:var(--text); }
  .rl-footprint-count { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px; color:var(--gold); white-space:nowrap; }
  .rl-footprint-companies { font-size:14px; color:var(--info-fg); }
  .rl-footprint-products { font-size:12px; color:var(--dim); }

  /* Assessment & Intel: field-note cards */
  .rl-note-card { background:var(--section-bg); border:1px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; flex-direction:column; gap:6px; }
  .rl-note-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .rl-note-company { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:14px; color:var(--text); }
  .rl-note-meta { font-size:11px; color:var(--dim); margin-left:auto; }
  .rl-note-body { font-size:13px; color:var(--muted); line-height:1.5; white-space:pre-wrap; }
  .rl-note-mentions { list-style:none; margin-top:6px; padding-top:6px; border-top:1px dashed var(--border); display:flex; flex-direction:column; gap:2px; }
  .rl-note-mentions li { font-size:12px; color:var(--dim); }
  .rl-note-mentions strong { color:var(--muted); }

  @media (max-width:640px) {
    .rl-header { padding:11px 14px; padding-top:calc(11px + env(safe-area-inset-top)); gap:8px; }
    .rl-brand-name { font-size:18px; }
    .rl-brand-sub { font-size:10px; }
    .rl-disc { width:30px; height:30px; }
    .rl-theme-toggle { padding:2px; gap:2px; }
    .rl-theme-btn { padding:9px 9px; font-size:10px; letter-spacing:0.03em; min-height:38px; }
    .rl-body { padding:16px 14px calc(40px + env(safe-area-inset-bottom)); }
    .rl-topbar { align-items:stretch; padding:12px 14px; gap:10px; }
    .rl-rep-field { width:100%; }
    .rl-input-sm { max-width:none; }
    .rl-row-2, .rl-row-3 { grid-template-columns:1fr; }
    .rl-lead-grid { grid-template-columns:1fr; }
    .rl-item-grid { grid-template-columns:1fr 1fr; }
    .rl-mode-toggle { margin-left:0; width:100%; }
    .rl-mode-btn { padding:12px 14px; }
    .rl-report-filters .rl-input { min-width:0; }
    .rl-stats { grid-template-columns:1fr 1fr; }
    .rl-compare-nums { gap:16px; }
    input, select, textarea, .rl-btn { font-size:16px; }
  }
  /* ── Estimate tab ── */
  .rl-est-ok {
    margin-top:12px; padding:10px 14px; border-radius:10px;
    background:rgba(45,140,122,0.14); color:#79d4c2;
    border:1px solid rgba(45,140,122,0.35); font-size:13px; font-weight:600;
  }
  .rl-est-list { display:flex; flex-direction:column; gap:10px; }
  .rl-est-card {
    display:flex; align-items:center; gap:12px; padding:12px 14px;
    background:var(--section-bg); border:1px solid var(--border); border-radius:10px;
  }
  .rl-est-main { flex:1; min-width:0; }
  .rl-est-num { font-weight:800; font-size:14px; letter-spacing:0.02em; color:var(--text); }
  .rl-est-client { font-size:13px; margin-top:1px; color:var(--text); }
  .rl-est-meta { font-size:11px; color:var(--muted); margin-top:3px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .rl-est-side { display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0; }
  .rl-est-total { font-weight:800; font-size:14px; white-space:nowrap; color:var(--text); }
  .rl-est-actions { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
  .rl-est-actions .rl-add-btn { text-decoration:none; text-align:center; }
  /* Full-screen app feel when launched from the home screen */
  @media (display-mode:standalone) {
    .rl-header { padding-top:calc(14px + env(safe-area-inset-top)); }
  }
`;
