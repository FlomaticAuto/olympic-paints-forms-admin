'use client';
import { useState, useEffect, useRef, useCallback, FormEvent, ChangeEvent } from 'react';

type Theme = 'theme-dark' | 'theme-light' | 'theme-navy';
const THEME_KEY = 'svc-theme';

const RATINGS = ['Not Satisfied', 'Somewhat Satisfied', 'Satisfied'] as const;
type Rating = typeof RATINGS[number];
const CONDITIONS = ['Poor', 'Fair', 'Good', 'Excellent'] as const;
type Condition = typeof CONDITIONS[number];

interface Booking {
  report_ref: string;
  store_name: string;
  store_address: string | null;
  visit_date: string;
  purpose: string;
  tasks: string[];
  merchandiser: string;
  booked_by: string | null;
}

const REPS = ['Aboo', 'Amit', 'Bhadresh', 'Byron', 'Nikhil', 'Quintus'];

interface StoreResult {
  id: string;
  name: string;
  code: string;
  dlref: string | null;
  curef: string | null;
  address: string | null;
  town: string | null;
}

const ADHOC_PURPOSES = [
  'Inventory Check',
  'Product Display Review',
  'Sales Training',
  'New Product Launch',
  'Merchandising',
  'Gazebo Day',
  'Ad-hoc Visit',
] as const;

interface PhotoField {
  key: string;
  label: string;
}

const PHOTO_FIELDS: PhotoField[] = [
  { key: 'photo_store_front',  label: 'Store Front' },
  { key: 'photo_stock_before', label: 'Stock Location — Before' },
  { key: 'photo_stock_after',  label: 'Stock Location — After' },
  { key: 'photo_chart_before', label: 'Colour Charts — Before' },
  { key: 'photo_chart_after',  label: 'Colour Charts — After' },
];

const MERCH_ITEMS = [
  { key: 'floor_vinyls',           label: 'Floor Vinyls' },
  { key: 'vertical_colour_chart',  label: 'Vertical Colour Chart' },
  { key: 'horizontal_colour_chart',label: 'Horizontal Colour Chart' },
  { key: 'shelf_wobblers',         label: 'Shelf Wobblers' },
  { key: 'big_colour_chart',       label: 'Big Colour Chart' },
  { key: 'pricing_boards',         label: 'Pricing Boards' },
] as const;

const SURVEY_ROWS = [
  { key: 'rating_service_delivery', label: 'Service Delivery Quality' },
  { key: 'rating_communication',    label: 'Communication' },
  { key: 'rating_rep_service',      label: 'Rep Service Level' },
  { key: 'rating_paperwork',        label: 'Quality of Paperwork' },
  { key: 'rating_logistics',        label: 'Logistics Service Level' },
] as const;

function nowLocal(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function genAdhocRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `ADH-${yy}${mm}${dd}-${rnd}`;
}

export default function StoreVisitCaptureForm() {
  const [theme, setThemeState] = useState<Theme>('theme-dark');
  useEffect(() => {
    const s = window.localStorage.getItem(THEME_KEY);
    if (s === 'theme-light' || s === 'theme-navy' || s === 'theme-dark') setThemeState(s as Theme);
  }, []);
  const setTheme = (t: Theme) => { setThemeState(t); window.localStorage.setItem(THEME_KEY, t); };

  // Visit mode: booked vs ad-hoc
  const [visitMode, setVisitMode] = useState<'booked' | 'adhoc'>('booked');

  // Step 0: open bookings dropdown
  const [openBookings,  setOpenBookings]  = useState<Booking[]>([]);
  const [loadingList,   setLoadingList]   = useState(true);
  const [svbRef,        setSvbRef]        = useState('');
  const [booking,       setBooking]       = useState<Booking | null>(null);
  const [lookupErr,     setLookupErr]     = useState<string | null>(null);

  // Ad-hoc mode state
  const [adhocQuery,      setAdhocQuery]      = useState('');
  const [adhocResults,    setAdhocResults]    = useState<StoreResult[]>([]);
  const [adhocSearching,  setAdhocSearching]  = useState(false);
  const [adhocStore,      setAdhocStore]      = useState<StoreResult | null>(null);
  const [adhocPurpose,    setAdhocPurpose]    = useState('');
  const [adhocDate,       setAdhocDate]       = useState(todayLocal);
  const [adhocRef,        setAdhocRef]        = useState('');

  useEffect(() => {
    fetch('/api/visit-capture/open-bookings')
      .then(r => r.json())
      .then(j => setOpenBookings(j.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  // Debounced store search for ad-hoc mode
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchStores = useCallback((q: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setAdhocResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setAdhocSearching(true);
      try {
        const res = await fetch(`/api/stores/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setAdhocResults(Array.isArray(data) ? data : []);
      } catch {
        setAdhocResults([]);
      } finally {
        setAdhocSearching(false);
      }
    }, 300);
  }, []);

  // Section 1
  const [checkinTime, setCheckinTime] = useState(nowLocal);

  // Section 2
  const [checkedStock,    setCheckedStock]    = useState<boolean | null>(null);
  const [checkedFifo,     setCheckedFifo]     = useState<boolean | null>(null);
  const [stockSufficient, setStockSufficient] = useState<boolean | null>(null);
  const [replenishment,   setReplenishment]   = useState<boolean | null>(null);
  const [repName,         setRepName]         = useState('');

  // Section 3: merch counts
  const [merchCounts, setMerchCounts] = useState<Record<string, number>>(
    Object.fromEntries(MERCH_ITEMS.map(m => [m.key, 0]))
  );
  const [otherMerch, setOtherMerch] = useState('');

  // Section 4
  const [chartsInPlace, setChartsInPlace] = useState<boolean | null>(null);

  // Section 5: photos — each slot holds multiple images
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []]))
  );
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, false]))
  );
  const [photoUrls, setPhotoUrls] = useState<Record<string, string[]>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []]))
  );

  // Section 6: survey
  const [spokeTo,       setSpokeTo]       = useState('');
  const [surveyDone,    setSurveyDone]    = useState<boolean | null>(null);
  const [ratings,       setRatings]       = useState<Record<string, Rating | ''>>(
    Object.fromEntries(SURVEY_ROWS.map(r => [r.key, '']))
  );
  const [custComments,  setCustComments]  = useState('');
  const [feedbackReason,setFeedbackReason]= useState('');
  const [storeCondition,setStoreCondition]= useState<Condition | ''>('');

  // Section 7
  const [checkoutTime,      setCheckoutTime]      = useState('');
  const [gazeboFeedback,    setGazeboFeedback]     = useState('');

  // Submit state
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const effectivePurpose = visitMode === 'adhoc' ? adhocPurpose : (booking?.purpose ?? '');
  const isGazebo = effectivePurpose.toLowerCase().includes('gazebo');

  // ── Select booking from dropdown ─────────────────────────────────────────
  function selectBooking(ref: string) {
    setSvbRef(ref);
    setLookupErr(null);
    if (!ref) { setBooking(null); setRepName(''); return; }
    const found = openBookings.find(b => b.report_ref === ref) ?? null;
    setBooking(found);
    if (found) {
      setCheckinTime(nowLocal());
      setRepName(found.booked_by ?? '');
    }
  }

  // ── Ad-hoc: select store from search results ──────────────────────────────
  function selectAdhocStore(store: StoreResult) {
    setAdhocStore(store);
    setAdhocQuery(store.name);
    setAdhocResults([]);
    setAdhocRef(genAdhocRef());
    setCheckinTime(nowLocal());
  }

  // ── Switch mode: clear the other mode's state ─────────────────────────────
  function switchMode(mode: 'booked' | 'adhoc') {
    setVisitMode(mode);
    // clear booked
    setBooking(null); setSvbRef(''); setLookupErr(null); setRepName('');
    // clear adhoc
    setAdhocStore(null); setAdhocQuery(''); setAdhocResults([]);
    setAdhocPurpose(''); setAdhocDate(todayLocal()); setAdhocRef('');
  }

  // ── Photo add: appends to the slot's list ────────────────────────────────
  async function handlePhoto(key: string, file: File | null) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreviews(p => ({ ...p, [key]: [...p[key], preview] }));
    setPhotoUploading(p => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      fd.append('ref', visitMode === 'adhoc' ? adhocRef : (booking?.report_ref ?? svbRef.trim().toUpperCase()));
      const res = await fetch('/api/visit-capture/upload-photo', { method: 'POST', body: fd });
      const j = await res.json();
      if (res.ok && j.url) {
        setPhotoUrls(p => ({ ...p, [key]: [...p[key], j.url] }));
      }
    } catch {
      // non-fatal
    } finally {
      setPhotoUploading(p => ({ ...p, [key]: false }));
    }
  }

  // ── Photo remove ──────────────────────────────────────────────────────────
  function removePhoto(key: string, index: number) {
    setPhotoPreviews(p => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));
    setPhotoUrls(p => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (visitMode === 'booked' && !booking) return;
    if (visitMode === 'adhoc' && (!adhocStore || !adhocPurpose || !adhocDate)) return;
    setBusy(true);
    setError(null);

    const isAdhoc = visitMode === 'adhoc';
    const visitDate = isAdhoc ? adhocDate : booking!.visit_date;

    const payload = {
      report_ref:                isAdhoc ? adhocRef : booking!.report_ref,
      store_name:                isAdhoc ? adhocStore!.name : booking!.store_name,
      store_address:             isAdhoc ? (adhocStore!.address ?? adhocStore!.town ?? '') : (booking!.store_address ?? ''),
      visit_date:                visitDate,
      merchandiser:              isAdhoc ? 'Gulab' : booking!.merchandiser,

      checked_stock_location:    checkedStock,
      checked_fifo:              checkedFifo,
      stock_on_floor_sufficient: stockSufficient,
      replenishment_order_placed:replenishment,
      rep_servicing_store:       repName.trim() || null,

      ...Object.fromEntries(MERCH_ITEMS.map(m => [m.key, merchCounts[m.key] || 0])),
      other_merch_items:         otherMerch.trim() || null,

      all_colour_charts_in_place: chartsInPlace,

      ...Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, photoUrls[p.key].length ? photoUrls[p.key] : null])),

      spoke_to:                  spokeTo.trim() || null,
      customer_survey_completed: surveyDone,
      ...Object.fromEntries(SURVEY_ROWS.map(r => [r.key, ratings[r.key] || null])),
      customer_comments:         custComments.trim() || null,
      customer_feedback_reason:  feedbackReason.trim() || null,
      overall_store_condition:   storeCondition || null,

      checked_in_at:  visitDate + 'T' + checkinTime + ':00',
      checked_out_at: checkoutTime ? visitDate + 'T' + checkoutTime + ':00' : null,
      gazebo_day_feedback: isGazebo ? (gazeboFeedback.trim() || null) : null,
    };

    try {
      const res = await fetch('/api/visit-capture/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Submission failed.'); setBusy(false); return; }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <main className={`svc-wrap ${theme}`}>
        <div className="svc-thanks">
          <div className="svc-check">✓</div>
          <h1>Visit Captured</h1>
          <p className="svc-ref">{visitMode === 'adhoc' ? adhocRef : (booking?.report_ref ?? svbRef)}</p>
          <p className="svc-sub">Store visit for <strong>{visitMode === 'adhoc' ? adhocStore?.name : booking?.store_name}</strong> has been recorded.</p>
          <button className="svc-submit" style={{ marginTop: 24 }} onClick={() => {
            setDone(false); setBooking(null); setSvbRef('');
            setAdhocStore(null); setAdhocQuery(''); setAdhocResults([]);
            setAdhocPurpose(''); setAdhocDate(todayLocal()); setAdhocRef('');
            setCheckedStock(null); setCheckedFifo(null); setStockSufficient(null);
            setReplenishment(null); setRepName(''); setMerchCounts(Object.fromEntries(MERCH_ITEMS.map(m => [m.key, 0])));
            setOtherMerch(''); setChartsInPlace(null);
            setPhotoPreviews(Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []])));
            setPhotoUrls(Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []])));
            setSpokeTo(''); setSurveyDone(null);
            setRatings(Object.fromEntries(SURVEY_ROWS.map(r => [r.key, ''])));
            setCustComments(''); setFeedbackReason(''); setStoreCondition('');
            setCheckoutTime(''); setGazeboFeedback(''); setError(null);
          }}>
            Capture Another Visit
          </button>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  return (
    <main className={`svc-wrap ${theme}`}>
      <form onSubmit={onSubmit} className="svc-frame" noValidate>

        {/* ── Header ── */}
        <header className="svc-header">
          <div className="svc-logo-wrap">
            <img src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg" alt="Olympic Paints" width={36} height={36} />
          </div>
          <div className="svc-title-block">
            <div className="svc-eyebrow">Olympic Paints · Merchandising</div>
            <h1>Store Visit Capture</h1>
          </div>
          <div className="svc-theme-toggle" role="group" aria-label="Display theme">
            {(['theme-dark', 'theme-light', 'theme-navy'] as Theme[]).map(t => (
              <button key={t} type="button"
                className={`svc-theme-btn${theme === t ? ' is-active' : ''}`}
                onClick={() => setTheme(t)}>
                {t === 'theme-dark' ? 'Dark' : t === 'theme-light' ? 'Light' : 'Navy'}
              </button>
            ))}
          </div>
        </header>

        <div className="svc-body">

          {/* ── Visit mode toggle ── */}
          <div className="svc-mode-toggle" role="group" aria-label="Visit type">
            <button type="button"
              className={`svc-mode-btn${visitMode === 'booked' ? ' is-active' : ''}`}
              onClick={() => switchMode('booked')}>
              Booked Visit
            </button>
            <button type="button"
              className={`svc-mode-btn${visitMode === 'adhoc' ? ' is-active' : ''}`}
              onClick={() => switchMode('adhoc')}>
              Ad-hoc Visit
            </button>
          </div>

          {/* ── Booked visit: dropdown ── */}
          {visitMode === 'booked' && (
            <>
              <div className="svc-section-label">Select Booked Visit</div>
              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-ref">Store to Visit <span className="svc-req">*</span></label>
                {loadingList
                  ? <p className="svc-hint">Loading booked visits…</p>
                  : openBookings.length === 0
                    ? <p className="svc-error-inline">No open visits booked. Ask your rep to book a visit first, or use Ad-hoc Visit.</p>
                    : <select
                        id="svc-ref"
                        className="svc-input"
                        value={svbRef}
                        onChange={e => selectBooking(e.target.value)}
                        disabled={!!booking}
                      >
                        <option value="">— Select a store —</option>
                        {openBookings.map(b => (
                          <option key={b.report_ref} value={b.report_ref}>
                            {b.store_name} · {b.visit_date}
                          </option>
                        ))}
                      </select>
                }
                {booking && (
                  <button type="button" className="svc-lookup-clear" style={{ marginTop: 8 }}
                    onClick={() => { setBooking(null); setSvbRef(''); setLookupErr(null); }}>
                    Change Store
                  </button>
                )}
                {lookupErr && <p className="svc-error svc-error-inline">{lookupErr}</p>}
              </div>
            </>
          )}

          {/* ── Ad-hoc visit: store search ── */}
          {visitMode === 'adhoc' && (
            <>
              <div className="svc-section-label">Ad-hoc Visit Details</div>

              <div className="svc-field" style={{ position: 'relative' }}>
                <label className="svc-label" htmlFor="svc-adhoc-store">Store <span className="svc-req">*</span></label>
                {adhocStore
                  ? (
                    <div className="svc-booking-card">
                      <div className="svc-booking-row">
                        <span className="svc-booking-label">Store</span>
                        <span className="svc-booking-val">{adhocStore.name}</span>
                      </div>
                      {(adhocStore.address || adhocStore.town) && (
                        <div className="svc-booking-row">
                          <span className="svc-booking-label">Location</span>
                          <span className="svc-booking-val">{adhocStore.address ?? adhocStore.town}</span>
                        </div>
                      )}
                      {adhocStore.code && (
                        <div className="svc-booking-row">
                          <span className="svc-booking-label">Code</span>
                          <span className="svc-booking-val">{adhocStore.code}</span>
                        </div>
                      )}
                      <button type="button" className="svc-lookup-clear" style={{ marginTop: 6 }}
                        onClick={() => { setAdhocStore(null); setAdhocQuery(''); setAdhocRef(''); }}>
                        Change Store
                      </button>
                    </div>
                  )
                  : (
                    <>
                      <input
                        id="svc-adhoc-store"
                        type="text"
                        className="svc-input"
                        placeholder="Type store name or town…"
                        value={adhocQuery}
                        autoComplete="off"
                        onChange={e => { setAdhocQuery(e.target.value); searchStores(e.target.value); }}
                      />
                      {adhocSearching && <p className="svc-hint">Searching…</p>}
                      {!adhocSearching && adhocResults.length > 0 && (
                        <ul className="svc-store-list">
                          {adhocResults.map(s => (
                            <li key={s.id} className="svc-store-item"
                              onClick={() => selectAdhocStore(s)}>
                              <span className="svc-store-name">{s.name}</span>
                              {s.town && <span className="svc-store-meta">{s.town}</span>}
                              {s.code && <span className="svc-store-meta">{s.code}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!adhocSearching && adhocQuery.length >= 2 && adhocResults.length === 0 && (
                        <p className="svc-hint">No stores found for "{adhocQuery}"</p>
                      )}
                    </>
                  )
                }
              </div>

              <div className="svc-row-2">
                <div className="svc-field">
                  <label className="svc-label" htmlFor="svc-adhoc-date">Visit Date <span className="svc-req">*</span></label>
                  <input id="svc-adhoc-date" type="date" className="svc-input svc-input-sm"
                    value={adhocDate} onChange={e => setAdhocDate(e.target.value)} required />
                </div>
                <div className="svc-field">
                  <label className="svc-label">Purpose <span className="svc-req">*</span></label>
                  <select className="svc-input" value={adhocPurpose} onChange={e => setAdhocPurpose(e.target.value)} required>
                    <option value="">— Select purpose —</option>
                    {ADHOC_PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {(visitMode === 'booked' ? !!booking : (!!adhocStore && !!adhocPurpose && !!adhocDate)) && (
            <>
              {/* Booking card — booked mode only (adhoc already shows store card above) */}
              {visitMode === 'booked' && booking && (
                <div className="svc-booking-card">
                  <div className="svc-booking-row"><span className="svc-booking-label">Store</span><span className="svc-booking-val">{booking.store_name}</span></div>
                  {booking.store_address && <div className="svc-booking-row"><span className="svc-booking-label">Address</span><span className="svc-booking-val">{booking.store_address}</span></div>}
                  <div className="svc-booking-row"><span className="svc-booking-label">Date</span><span className="svc-booking-val">{booking.visit_date}</span></div>
                  <div className="svc-booking-row"><span className="svc-booking-label">Purpose</span><span className="svc-booking-val">{booking.purpose}</span></div>
                  {booking.tasks.length > 0 && <div className="svc-booking-row"><span className="svc-booking-label">Tasks</span><span className="svc-booking-val">{booking.tasks.join(', ')}</span></div>}
                </div>
              )}

              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-checkin">Check-in Time <span className="svc-req">*</span></label>
                <input id="svc-checkin" type="time" className="svc-input svc-input-sm" value={checkinTime} onChange={e => setCheckinTime(e.target.value)} required />
              </div>

              {/* ── Section 2: Stock ── */}
              <div className="svc-section-label">Stock Check</div>
              <div className="svc-yn-grid">
                <YesNo label="Checked stock location?" value={checkedStock} onChange={setCheckedStock} />
                <YesNo label="Checked FIFO (old stock in front)?" value={checkedFifo} onChange={setCheckedFifo} />
                <YesNo label="Stock on floor sufficient?" value={stockSufficient} onChange={setStockSufficient} />
                <YesNo label="Suggested replenishment order placed?" value={replenishment} onChange={setReplenishment} />
              </div>
              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-rep">Rep who services this store</label>
                {visitMode === 'booked'
                  ? <input
                      id="svc-rep"
                      type="text"
                      className="svc-input svc-input-readonly"
                      value={repName}
                      readOnly
                    />
                  : <select
                      id="svc-rep"
                      className="svc-input"
                      value={repName}
                      onChange={e => setRepName(e.target.value)}
                    >
                      <option value="">— Select rep —</option>
                      {REPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                }
              </div>

              {/* ── Section 3: Merch materials ── */}
              <div className="svc-section-label">Merchandising Materials Placed</div>
              <div className="svc-merch-grid">
                {MERCH_ITEMS.map(m => (
                  <div key={m.key} className="svc-merch-row">
                    <span className="svc-merch-label">{m.label}</span>
                    <div className="svc-stepper">
                      <button type="button" className="svc-step-btn" onClick={() => setMerchCounts(p => ({ ...p, [m.key]: Math.max(0, (p[m.key] ?? 0) - 1) }))}>−</button>
                      <span className="svc-step-val">{merchCounts[m.key] ?? 0}</span>
                      <button type="button" className="svc-step-btn" onClick={() => setMerchCounts(p => ({ ...p, [m.key]: (p[m.key] ?? 0) + 1 }))}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-other-merch">Other items placed</label>
                <input id="svc-other-merch" type="text" className="svc-input" placeholder="Describe any other merchandising items…" value={otherMerch} onChange={e => setOtherMerch(e.target.value)} />
              </div>

              {/* ── Section 4: Colour charts ── */}
              <div className="svc-section-label">Colour Charts</div>
              <div className="svc-yn-grid">
                <YesNo label="All colour charts in place?" value={chartsInPlace} onChange={setChartsInPlace} />
              </div>

              {/* ── Section 5: Photos ── */}
              <div className="svc-section-label">Photos</div>
              <div className="svc-photo-sections">
                {PHOTO_FIELDS.map(f => (
                  <PhotoSlot
                    key={f.key}
                    label={f.label}
                    previews={photoPreviews[f.key]}
                    uploading={photoUploading[f.key]}
                    onAdd={file => handlePhoto(f.key, file)}
                    onRemove={index => removePhoto(f.key, index)}
                  />
                ))}
              </div>

              {/* ── Section 6: Survey ── */}
              <div className="svc-section-label">Store Survey</div>
              <div className="svc-row-2">
                <div className="svc-field">
                  <label className="svc-label" htmlFor="svc-spoke">Spoke to</label>
                  <input id="svc-spoke" type="text" className="svc-input" placeholder="Contact name" value={spokeTo} onChange={e => setSpokeTo(e.target.value)} />
                </div>
                <div className="svc-field">
                  <label className="svc-label">Overall store condition</label>
                  <div className="svc-pill-grid">
                    {CONDITIONS.map(c => (
                      <button key={c} type="button"
                        className={`svc-pill${storeCondition === c ? ' is-active' : ''}`}
                        onClick={() => setStoreCondition(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="svc-yn-grid" style={{ gridTemplateColumns: '1fr' }}>
                <YesNo label="Customer survey completed?" value={surveyDone} onChange={setSurveyDone} />
              </div>

              {/* Ratings */}
              <div className="svc-ratings-table">
                <div className="svc-ratings-header">
                  <span></span>
                  {RATINGS.map(r => <span key={r} className="svc-rating-col-head">{r}</span>)}
                </div>
                {SURVEY_ROWS.map(row => (
                  <div key={row.key} className="svc-rating-row">
                    <span className="svc-rating-label">{row.label}</span>
                    {RATINGS.map(r => (
                      <button key={r} type="button"
                        className={`svc-rating-btn${ratings[row.key] === r ? ' is-active' : ''}`}
                        onClick={() => setRatings(p => ({ ...p, [row.key]: r }))}>
                        {ratings[row.key] === r ? '●' : '○'}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-comments">Customer comments</label>
                <textarea id="svc-comments" className="svc-input svc-textarea" rows={2} placeholder="What did the customer say?" value={custComments} onChange={e => setCustComments(e.target.value)} />
              </div>
              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-reason">Customer feedback reason</label>
                <input id="svc-reason" type="text" className="svc-input" placeholder="Why did the customer give that rating?" value={feedbackReason} onChange={e => setFeedbackReason(e.target.value)} />
              </div>

              {/* ── Section 7: Close ── */}
              <div className="svc-section-label">Visit Close</div>
              <div className="svc-field">
                <label className="svc-label" htmlFor="svc-checkout">Check-out Time</label>
                <input id="svc-checkout" type="time" className="svc-input svc-input-sm" value={checkoutTime} onChange={e => setCheckoutTime(e.target.value)} />
              </div>
              {isGazebo && (
                <div className="svc-field">
                  <label className="svc-label" htmlFor="svc-gazebo">Gazebo Day Feedback</label>
                  <textarea id="svc-gazebo" className="svc-input svc-textarea" rows={3} placeholder="Notes from the gazebo day event…" value={gazeboFeedback} onChange={e => setGazeboFeedback(e.target.value)} />
                </div>
              )}

              {error && <p className="svc-error">{error}</p>}

              <button type="submit" className="svc-submit" disabled={busy || !checkinTime}>
                {busy ? 'Saving…' : '✓ Submit Visit Capture'}
              </button>
            </>
          )}

        </div>
      </form>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="svc-yn-field">
      <span className="svc-yn-label">{label}</span>
      <div className="svc-yn-btns">
        <button type="button" className={`svc-yn-btn svc-yn-yes${value === true ? ' is-active' : ''}`} onClick={() => onChange(true)}>Yes</button>
        <button type="button" className={`svc-yn-btn svc-yn-no${value === false ? ' is-active' : ''}`} onClick={() => onChange(false)}>No</button>
      </div>
    </div>
  );
}

function PhotoSlot({ label, previews, uploading, onAdd, onRemove }: {
  label: string;
  previews: string[];
  uploading: boolean;
  onAdd: (f: File | null) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    // allow picking multiple at once
    for (let i = 0; i < files.length; i++) onAdd(files[i]);
    e.target.value = '';
  }
  return (
    <div className="svc-photo-slot">
      <div className="svc-photo-slot-header">
        <span className="svc-photo-slot-label">{label}</span>
        {previews.length > 0 && (
          <span className="svc-photo-slot-count">{previews.length} photo{previews.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      <div className="svc-photo-row">
        {previews.map((src, i) => (
          <div key={i} className="svc-photo-thumb">
            <img src={src} alt={`${label} ${i + 1}`} className="svc-photo-thumb-img" />
            <button
              type="button"
              className="svc-photo-remove"
              onClick={() => onRemove(i)}
              aria-label="Remove photo"
            >×</button>
          </div>
        ))}
        <div className="svc-photo-add-tile" onClick={() => inputRef.current?.click()}>
          {uploading
            ? <span className="svc-photo-status svc-uploading" style={{ fontSize: 20 }}>↑</span>
            : <><span className="svc-photo-icon">📷</span><span className="svc-photo-add-lbl">Add</span></>
          }
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  .svc-wrap { min-height:100vh; margin:0; padding:16px; box-sizing:border-box; font-family:'Barlow',sans-serif; }

  .svc-wrap.theme-dark {
    --p:#0D0D0B; --base:#1A1A18; --elev:#2E2E2C; --sunken:#0D0D0B;
    --yellow:#F5C400; --yellow-h:#FAE04D; --text:#E8E7E2; --muted:#949390; --dim:#5C5B58;
    --border:rgba(255,255,255,0.10); --border-s:rgba(255,255,255,0.06);
    --focus:#F5C400; --sel-bg:#F5C400; --sel-fg:#0D0D0B; --sel-bd:#F5C400;
    --danger-bg:rgba(232,96,96,0.12); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.30);
    --success-bg:rgba(45,140,122,0.12); --success-fg:#C8EDE7; --success-bd:rgba(45,140,122,0.30);
    --info-bg:rgba(26,61,110,0.30); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.30);
    --section-bg:rgba(245,196,0,0.06);
    background:var(--p); color:var(--text);
  }
  .svc-wrap.theme-light {
    --p:#F7F6F3; --base:#FFFFFF; --elev:#FFFFFF; --sunken:#F0EFEA;
    --yellow:#F5C400; --yellow-h:#D4A800; --text:#0D0D0B; --muted:#5C5B58; --dim:#949390;
    --border:#C8C7C0; --border-s:#E8E7E2;
    --focus:#1A3D6E; --sel-bg:#F5C400; --sel-fg:#0D0D0B; --sel-bd:#A88000;
    --danger-bg:#FEF2F2; --danger-fg:#C0392B; --danger-bd:#E86060;
    --success-bg:#EDF7F5; --success-fg:#1a5c50; --success-bd:#2D8C7A;
    --info-bg:#E8EFF8; --info-fg:#1A3D6E; --info-bd:#B8CCE8;
    --section-bg:rgba(245,196,0,0.08);
    background:var(--p); color:var(--text);
  }
  .svc-wrap.theme-navy {
    --p:#071022; --base:#0D2040; --elev:#1A3D6E; --sunken:#071022;
    --yellow:#F5C400; --yellow-h:#FAE04D; --text:#FFFFFF; --muted:#B8CCE8; --dim:#6B9ED0;
    --border:rgba(107,158,208,0.20); --border-s:rgba(107,158,208,0.12);
    --focus:#F5C400; --sel-bg:#F5C400; --sel-fg:#071022; --sel-bd:#F5C400;
    --danger-bg:rgba(232,96,96,0.14); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.35);
    --success-bg:rgba(45,140,122,0.15); --success-fg:#C8EDE7; --success-bd:rgba(45,140,122,0.35);
    --info-bg:rgba(45,107,168,0.20); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.35);
    --section-bg:rgba(107,158,208,0.08);
    background:var(--p); color:var(--text);
  }

  .svc-frame { max-width:860px; margin:0 auto; display:flex; flex-direction:column; gap:0; }

  /* Header */
  .svc-header {
    display:flex; align-items:center; gap:12px;
    background:var(--base); border:1px solid var(--border);
    border-radius:12px 12px 0 0; padding:12px 16px;
  }
  .svc-logo-wrap { width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0; }
  .svc-logo-wrap img { display:block; width:100%; height:100%; object-fit:cover; }
  .svc-title-block { line-height:1; }
  .svc-eyebrow { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.12em; color:var(--dim); }
  h1 { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:22px; text-transform:uppercase; color:var(--yellow); margin:2px 0 0; line-height:1; }

  /* Theme toggle */
  .svc-theme-toggle { display:flex; gap:3px; background:var(--sunken); border-radius:8px; padding:3px; margin-left:auto; }
  .svc-theme-btn {
    background:transparent; border:0; color:var(--muted); border-radius:6px; padding:6px 12px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer; min-height:32px;
    transition:background 0.12s,color 0.12s;
  }
  .svc-theme-btn:hover { background:var(--elev); color:var(--text); }
  .svc-theme-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); font-weight:900; }
  .svc-theme-btn:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }

  /* Body */
  .svc-body {
    background:var(--base); border:1px solid var(--border); border-top:0;
    border-radius:0 0 12px 12px; padding:20px 20px 24px;
    display:flex; flex-direction:column; gap:16px;
  }

  /* Section labels */
  .svc-section-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:11px;
    text-transform:uppercase; letter-spacing:0.12em; color:var(--yellow);
    background:var(--section-bg); border-left:3px solid var(--yellow);
    padding:6px 10px; border-radius:0 6px 6px 0; margin-top:4px;
  }

  /* Fields */
  .svc-field { display:flex; flex-direction:column; gap:7px; }
  .svc-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
  .svc-req { color:var(--yellow); }
  .svc-input {
    width:100%; box-sizing:border-box; padding:10px 12px; min-height:42px;
    font-size:14px; font-family:'Barlow',sans-serif;
    background:var(--sunken); color:var(--text);
    border:1px solid var(--border); border-radius:8px; appearance:none; -webkit-appearance:none;
    transition:border-color 0.12s;
  }
  .svc-input:focus { outline:none; border-color:var(--yellow); box-shadow:0 0 0 3px rgba(245,196,0,0.18); }
  .svc-input-sm { max-width:160px; }
  .svc-input-readonly { color:var(--muted); cursor:default; }
  .svc-input-readonly:focus { border-color:var(--border); box-shadow:none; }
  .svc-textarea { min-height:72px; resize:vertical; }

  /* Mode toggle */
  .svc-mode-toggle { display:flex; gap:4px; background:var(--sunken); border-radius:10px; padding:4px; }
  .svc-mode-btn {
    flex:1; padding:10px 16px; min-height:40px;
    background:transparent; border:0; color:var(--muted);
    border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;
    transition:background 0.12s,color 0.12s;
  }
  .svc-mode-btn:hover { background:var(--elev); color:var(--text); }
  .svc-mode-btn.is-active { background:var(--yellow); color:var(--sunken); font-weight:900; }
  .svc-mode-btn:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }

  /* Store search hint */
  .svc-hint { margin:4px 0 0; font-size:12px; color:var(--dim); }

  /* Store search results */
  .svc-store-list {
    list-style:none; margin:4px 0 0; padding:0;
    background:var(--elev); border:1px solid var(--border);
    border-radius:8px; overflow:hidden; position:absolute;
    left:0; right:0; z-index:20; box-shadow:0 4px 16px rgba(0,0,0,0.3);
  }
  .svc-store-item {
    display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
    padding:10px 14px; cursor:pointer;
    border-bottom:1px solid var(--border-s);
    transition:background 0.1s;
  }
  .svc-store-item:last-child { border-bottom:0; }
  .svc-store-item:hover { background:var(--section-bg); }
  .svc-store-name { font-size:13px; color:var(--text); font-weight:500; }
  .svc-store-meta { font-family:'Barlow Condensed',sans-serif; font-size:10px; color:var(--dim); text-transform:uppercase; letter-spacing:0.06em; }

  /* Lookup row */
  .svc-lookup-row { display:flex; gap:8px; align-items:center; }
  .svc-lookup-row .svc-input { flex:1; }
  .svc-lookup-btn, .svc-lookup-clear {
    flex-shrink:0; padding:10px 18px; min-height:42px;
    background:var(--yellow); color:var(--sunken); border:0; border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:13px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;
    transition:background 0.12s;
  }
  .svc-lookup-btn:hover:not(:disabled) { background:var(--yellow-h); }
  .svc-lookup-btn:disabled { opacity:0.45; cursor:not-allowed; }
  .svc-lookup-clear { background:var(--elev); color:var(--muted); border:1px solid var(--border); }
  .svc-lookup-clear:hover { color:var(--text); }

  /* Booking card */
  .svc-booking-card {
    background:var(--info-bg); border:1px solid var(--info-bd);
    border-radius:8px; padding:10px 14px;
    display:flex; flex-direction:column; gap:4px;
  }
  .svc-booking-row { display:flex; gap:8px; align-items:baseline; }
  .svc-booking-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--info-fg); min-width:58px; }
  .svc-booking-val { font-size:13px; color:var(--info-fg); }

  /* Yes/No */
  .svc-yn-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .svc-yn-field { display:flex; flex-direction:column; gap:6px; background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:10px 12px; }
  .svc-yn-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); line-height:1.3; }
  .svc-yn-btns { display:flex; gap:6px; }
  .svc-yn-btn {
    flex:1; padding:8px; min-height:36px; border-radius:7px;
    border:1px solid var(--border); background:var(--elev); color:var(--text);
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px;
    text-transform:uppercase; cursor:pointer; transition:background 0.1s,border-color 0.1s;
  }
  .svc-yn-yes.is-active { background:var(--success-bg); color:var(--success-fg); border-color:var(--success-bd); }
  .svc-yn-no.is-active  { background:var(--danger-bg);  color:var(--danger-fg);  border-color:var(--danger-bd);  }

  /* Merch stepper */
  .svc-merch-grid { display:flex; flex-direction:column; gap:6px; }
  .svc-merch-row { display:flex; align-items:center; justify-content:space-between; background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:10px 14px; }
  .svc-merch-label { font-size:13px; color:var(--text); }
  .svc-stepper { display:flex; align-items:center; gap:0; }
  .svc-step-btn {
    width:34px; height:34px; border-radius:7px; border:1px solid var(--border);
    background:var(--elev); color:var(--text); font-size:18px; line-height:1;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:background 0.1s;
  }
  .svc-step-btn:hover { background:var(--section-bg); border-color:var(--yellow); }
  .svc-step-val {
    min-width:40px; text-align:center;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:18px;
    color:var(--yellow);
  }

  /* Photo slots */
  .svc-photo-sections { display:flex; flex-direction:column; gap:12px; }
  .svc-photo-slot { background:var(--sunken); border:1px solid var(--border-s); border-radius:10px; padding:10px 12px; }
  .svc-photo-slot-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .svc-photo-slot-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); }
  .svc-photo-slot-count { font-family:'Barlow Condensed',sans-serif; font-size:10px; color:var(--yellow); font-weight:700; }
  .svc-photo-row { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; }
  .svc-photo-thumb { position:relative; width:80px; height:80px; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .svc-photo-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
  .svc-photo-remove {
    position:absolute; top:3px; right:3px;
    width:20px; height:20px; border-radius:50%;
    background:rgba(0,0,0,0.65); color:#fff; border:0;
    font-size:14px; line-height:1; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    padding:0;
  }
  .svc-photo-remove:hover { background:rgba(232,96,96,0.85); }
  .svc-photo-add-tile {
    width:80px; height:80px; border-radius:8px;
    border:2px dashed var(--border); background:var(--elev);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
    cursor:pointer; flex-shrink:0;
    transition:border-color 0.12s;
  }
  .svc-photo-add-tile:hover { border-color:var(--yellow); }
  .svc-photo-icon { font-size:22px; }
  .svc-photo-add-lbl { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:var(--dim); }
  .svc-photo-status { font-size:13px; font-weight:700; }
  .svc-uploading { color:var(--yellow); animation:spin 1s linear infinite; }
  .svc-uploaded { color:var(--success-fg); }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* Ratings table */
  .svc-ratings-table { display:flex; flex-direction:column; gap:4px; }
  .svc-ratings-header { display:grid; grid-template-columns:1fr repeat(3,80px); gap:4px; padding:0 4px; }
  .svc-rating-col-head { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:var(--dim); text-align:center; }
  .svc-rating-row { display:grid; grid-template-columns:1fr repeat(3,80px); gap:4px; align-items:center; background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:8px 10px; }
  .svc-rating-label { font-size:12px; color:var(--text); }
  .svc-rating-btn {
    width:100%; min-height:34px; border-radius:6px; border:1px solid var(--border);
    background:var(--elev); color:var(--muted); font-size:16px;
    cursor:pointer; transition:background 0.1s,color 0.1s;
  }
  .svc-rating-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); border-color:var(--sel-bd); }

  /* Pills */
  .svc-pill-grid { display:flex; flex-wrap:wrap; gap:6px; }
  .svc-pill {
    background:var(--sunken); border:1px solid var(--border); color:var(--text);
    border-radius:8px; padding:8px 14px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; cursor:pointer; min-height:36px;
    transition:background 0.1s,border-color 0.1s;
  }
  .svc-pill:hover { border-color:var(--yellow); }
  .svc-pill.is-active { background:var(--sel-bg); color:var(--sel-fg); border-color:var(--sel-bd); font-weight:900; }

  /* Layout */
  .svc-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

  /* Error */
  .svc-error { color:var(--danger-fg); background:var(--danger-bg); border:1px solid var(--danger-bd); padding:10px 14px; border-radius:8px; font-size:13px; margin:0; }
  .svc-error-inline { margin-top:0; }

  /* Submit */
  .svc-submit {
    width:100%; padding:14px; min-height:50px;
    background:var(--yellow); color:var(--sunken); border:0; border-radius:10px;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:16px;
    text-transform:uppercase; letter-spacing:0.1em; cursor:pointer;
    transition:background 0.15s,opacity 0.15s;
  }
  .svc-submit:hover:not(:disabled) { background:var(--yellow-h); }
  .svc-submit:disabled { opacity:0.45; cursor:not-allowed; }

  /* Thanks */
  .svc-thanks {
    max-width:520px; margin:80px auto; background:var(--base);
    border:1px solid var(--border); border-radius:12px; padding:40px 28px;
    text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.3);
  }
  .svc-check { font-size:52px; color:#2D8C7A; margin-bottom:16px; }
  .svc-ref { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:22px; color:var(--yellow); margin:8px 0; }
  .svc-sub { color:var(--muted); font-size:15px; line-height:1.6; margin-top:12px; }

  /* Mobile */
  @media (max-width:680px) {
    .svc-wrap { padding:0; }
    .svc-frame { border-radius:0; }
    .svc-header { flex-wrap:wrap; border-radius:0; padding:12px 14px; position:sticky; top:0; z-index:10; }
    .svc-body { padding:14px 12px 32px; border-radius:0; }
    .svc-yn-grid { grid-template-columns:1fr; }
    .svc-row-2 { grid-template-columns:1fr; }
    .svc-photo-thumb { width:70px; height:70px; }
    .svc-photo-add-tile { width:70px; height:70px; }
    .svc-ratings-header { grid-template-columns:1fr repeat(3,56px); }
    .svc-rating-row { grid-template-columns:1fr repeat(3,56px); }
    .svc-rating-col-head { font-size:8px; }
    .svc-input { font-size:16px; }
    .svc-submit { min-height:54px; font-size:17px; border-radius:12px; }
    .svc-thanks { margin:24px 16px; padding:32px 20px; }
  }

  @media (hover:none) {
    .svc-yn-btn:hover,
    .svc-photo-cell:hover { border-color:var(--border); }
  }
`;
