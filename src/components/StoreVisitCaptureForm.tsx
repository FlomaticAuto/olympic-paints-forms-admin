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
  { key: 'photo_stock_before', label: 'Stock — Before' },
  { key: 'photo_stock_after',  label: 'Stock — After' },
  { key: 'photo_chart_before', label: 'Charts — Before' },
  { key: 'photo_chart_after',  label: 'Charts — After' },
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
  { key: 'rating_service_delivery', label: 'Service Delivery' },
  { key: 'rating_communication',    label: 'Communication' },
  { key: 'rating_rep_service',      label: 'Rep Service Level' },
  { key: 'rating_paperwork',        label: 'Paperwork Quality' },
  { key: 'rating_logistics',        label: 'Logistics' },
] as const;

const STEPS = [
  { id: 'setup',   label: 'Visit Setup',    icon: '📋' },
  { id: 'stock',   label: 'Stock Check',    icon: '📦' },
  { id: 'merch',   label: 'Merchandising',  icon: '🖼' },
  { id: 'charts',  label: 'Colour Charts',  icon: '🎨' },
  { id: 'photos',  label: 'Photos',         icon: '📷' },
  { id: 'survey',  label: 'Store Survey',   icon: '⭐' },
  { id: 'close',   label: 'Close & Submit', icon: '✓' },
] as const;
type StepId = typeof STEPS[number]['id'];

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
  const [theme, setThemeState] = useState<Theme>('theme-navy');
  useEffect(() => {
    const s = window.localStorage.getItem(THEME_KEY);
    if (s === 'theme-light' || s === 'theme-navy' || s === 'theme-dark') setThemeState(s as Theme);
  }, []);
  const setTheme = (t: Theme) => { setThemeState(t); window.localStorage.setItem(THEME_KEY, t); };

  const [activeStep, setActiveStep] = useState<StepId>('setup');

  // Visit mode
  const [visitMode, setVisitMode] = useState<'booked' | 'adhoc'>('booked');

  // Booked
  const [openBookings,  setOpenBookings]  = useState<Booking[]>([]);
  const [loadingList,   setLoadingList]   = useState(true);
  const [svbRef,        setSvbRef]        = useState('');
  const [booking,       setBooking]       = useState<Booking | null>(null);
  const [lookupErr,     setLookupErr]     = useState<string | null>(null);

  // Ad-hoc
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

  const [checkinTime, setCheckinTime] = useState(nowLocal);

  // Stock
  const [checkedStock,    setCheckedStock]    = useState<boolean | null>(null);
  const [checkedFifo,     setCheckedFifo]     = useState<boolean | null>(null);
  const [stockSufficient, setStockSufficient] = useState<boolean | null>(null);
  const [replenishment,   setReplenishment]   = useState<boolean | null>(null);
  const [repName,         setRepName]         = useState('');

  // Merch
  const [merchCounts, setMerchCounts] = useState<Record<string, number>>(
    Object.fromEntries(MERCH_ITEMS.map(m => [m.key, 0]))
  );
  const [otherMerch, setOtherMerch] = useState('');

  // Charts
  const [chartsInPlace, setChartsInPlace] = useState<boolean | null>(null);

  // Photos
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []]))
  );
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, false]))
  );
  const [photoUrls, setPhotoUrls] = useState<Record<string, string[]>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, []]))
  );

  // Survey
  const [spokeTo,       setSpokeTo]       = useState('');
  const [surveyDone,    setSurveyDone]    = useState<boolean | null>(null);
  const [ratings,       setRatings]       = useState<Record<string, Rating | ''>>(
    Object.fromEntries(SURVEY_ROWS.map(r => [r.key, '']))
  );
  const [custComments,  setCustComments]  = useState('');
  const [feedbackReason,setFeedbackReason]= useState('');
  const [storeCondition,setStoreCondition]= useState<Condition | ''>('');

  // Close
  const [checkoutTime,   setCheckoutTime]   = useState('');
  const [gazeboFeedback, setGazeboFeedback] = useState('');

  // Submit state
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const effectivePurpose = visitMode === 'adhoc' ? adhocPurpose : (booking?.purpose ?? '');
  const isGazebo = effectivePurpose.toLowerCase().includes('gazebo');
  const storeReady = visitMode === 'booked' ? !!booking : (!!adhocStore && !!adhocPurpose && !!adhocDate);

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

  function selectAdhocStore(store: StoreResult) {
    setAdhocStore(store);
    setAdhocQuery(store.name);
    setAdhocResults([]);
    setAdhocRef(genAdhocRef());
    setCheckinTime(nowLocal());
  }

  function switchMode(mode: 'booked' | 'adhoc') {
    setVisitMode(mode);
    setBooking(null); setSvbRef(''); setLookupErr(null); setRepName('');
    setAdhocStore(null); setAdhocQuery(''); setAdhocResults([]);
    setAdhocPurpose(''); setAdhocDate(todayLocal()); setAdhocRef('');
  }

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

  function removePhoto(key: string, index: number) {
    setPhotoPreviews(p => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));
    setPhotoUrls(p => ({ ...p, [key]: p[key].filter((_, i) => i !== index) }));
  }

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
      if (visitMode === 'booked' && booking) {
        setOpenBookings(prev => prev.filter(b => b.report_ref !== booking.report_ref));
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  function resetForm() {
    setDone(false); setActiveStep('setup');
    setBooking(null); setSvbRef('');
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
          <button className="svc-submit" style={{ marginTop: 24, maxWidth: 320, margin: '24px auto 0' }} onClick={resetForm}>
            Capture Another Visit
          </button>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  // ── Step content renderer ─────────────────────────────────────────────────
  function renderStep() {
    switch (activeStep) {

      case 'setup': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Visit Setup</div>

          <div className="svc-mode-toggle" role="group">
            <button type="button" className={`svc-mode-btn${visitMode === 'booked' ? ' is-active' : ''}`}
              onClick={() => switchMode('booked')}>Booked Visit</button>
            <button type="button" className={`svc-mode-btn${visitMode === 'adhoc' ? ' is-active' : ''}`}
              onClick={() => switchMode('adhoc')}>Ad-hoc Visit</button>
          </div>

          {visitMode === 'booked' && (
            <div className="svc-field">
              <label className="svc-label">Store to Visit <span className="svc-req">*</span></label>
              {loadingList
                ? <p className="svc-hint">Loading booked visits…</p>
                : openBookings.length === 0
                  ? <p className="svc-error-inline svc-error">No open visits booked. Use Ad-hoc Visit instead.</p>
                  : <select className="svc-input" value={svbRef}
                      onChange={e => selectBooking(e.target.value)} disabled={!!booking}>
                      <option value="">— Select a store —</option>
                      {openBookings.map(b => (
                        <option key={b.report_ref} value={b.report_ref}>{b.store_name} · {b.visit_date}</option>
                      ))}
                    </select>
              }
              {booking && (
                <button type="button" className="svc-clear-btn"
                  onClick={() => { setBooking(null); setSvbRef(''); setLookupErr(null); }}>
                  Change Store
                </button>
              )}
              {lookupErr && <p className="svc-error">{lookupErr}</p>}
            </div>
          )}

          {visitMode === 'adhoc' && (
            <>
              <div className="svc-field" style={{ position: 'relative' }}>
                <label className="svc-label">Store <span className="svc-req">*</span></label>
                {adhocStore
                  ? (
                    <div className="svc-booking-card">
                      <div className="svc-booking-row"><span className="svc-booking-label">Store</span><span className="svc-booking-val">{adhocStore.name}</span></div>
                      {(adhocStore.address || adhocStore.town) && (
                        <div className="svc-booking-row"><span className="svc-booking-label">Location</span><span className="svc-booking-val">{adhocStore.address ?? adhocStore.town}</span></div>
                      )}
                      {adhocStore.code && (
                        <div className="svc-booking-row"><span className="svc-booking-label">Code</span><span className="svc-booking-val">{adhocStore.code}</span></div>
                      )}
                      <button type="button" className="svc-clear-btn" style={{ marginTop: 6 }}
                        onClick={() => { setAdhocStore(null); setAdhocQuery(''); setAdhocRef(''); }}>
                        Change Store
                      </button>
                    </div>
                  )
                  : (
                    <>
                      <input type="text" className="svc-input" placeholder="Type store name or town…"
                        value={adhocQuery} autoComplete="off"
                        onChange={e => { setAdhocQuery(e.target.value); searchStores(e.target.value); }} />
                      {adhocSearching && <p className="svc-hint">Searching…</p>}
                      {!adhocSearching && adhocResults.length > 0 && (
                        <ul className="svc-store-list">
                          {adhocResults.map(s => (
                            <li key={s.id} className="svc-store-item" onClick={() => selectAdhocStore(s)}>
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
                  <label className="svc-label">Visit Date <span className="svc-req">*</span></label>
                  <input type="date" className="svc-input" value={adhocDate} onChange={e => setAdhocDate(e.target.value)} required />
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

          {storeReady && (
            <>
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
                <label className="svc-label">Check-in Time <span className="svc-req">*</span></label>
                <input type="time" className="svc-input svc-input-sm" value={checkinTime} onChange={e => setCheckinTime(e.target.value)} required />
              </div>
            </>
          )}

          {storeReady && (
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('stock')}>
              Next: Stock Check →
            </button>
          )}
        </div>
      );

      case 'stock': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Stock Check</div>
          <div className="svc-yn-grid">
            <YesNo label="Checked stock location?" value={checkedStock} onChange={setCheckedStock} />
            <YesNo label="Checked FIFO?" value={checkedFifo} onChange={setCheckedFifo} />
            <YesNo label="Stock on floor sufficient?" value={stockSufficient} onChange={setStockSufficient} />
            <YesNo label="Replenishment order placed?" value={replenishment} onChange={setReplenishment} />
          </div>
          <div className="svc-field" style={{ marginTop: 8 }}>
            <label className="svc-label">Rep who services this store</label>
            {visitMode === 'booked'
              ? <input type="text" className="svc-input svc-input-readonly" value={repName} readOnly />
              : <select className="svc-input" value={repName} onChange={e => setRepName(e.target.value)}>
                  <option value="">— Select rep —</option>
                  {REPS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            }
          </div>
          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('setup')}>← Back</button>
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('merch')}>Next: Merchandising →</button>
          </div>
        </div>
      );

      case 'merch': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Merchandising Materials</div>
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
          <div className="svc-field" style={{ marginTop: 8 }}>
            <label className="svc-label">Other items placed</label>
            <input type="text" className="svc-input" placeholder="Describe any other items…" value={otherMerch} onChange={e => setOtherMerch(e.target.value)} />
          </div>
          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('stock')}>← Back</button>
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('charts')}>Next: Colour Charts →</button>
          </div>
        </div>
      );

      case 'charts': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Colour Charts</div>
          <div className="svc-yn-grid" style={{ gridTemplateColumns: '1fr' }}>
            <YesNo label="All colour charts in place and correctly positioned?" value={chartsInPlace} onChange={setChartsInPlace} />
          </div>
          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('merch')}>← Back</button>
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('photos')}>Next: Photos →</button>
          </div>
        </div>
      );

      case 'photos': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Photos</div>
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
          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('charts')}>← Back</button>
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('survey')}>Next: Survey →</button>
          </div>
        </div>
      );

      case 'survey': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Store Survey</div>
          <div className="svc-row-2">
            <div className="svc-field">
              <label className="svc-label">Spoke to</label>
              <input type="text" className="svc-input" placeholder="Contact name" value={spokeTo} onChange={e => setSpokeTo(e.target.value)} />
            </div>
            <div className="svc-field">
              <label className="svc-label">Overall store condition</label>
              <div className="svc-pill-grid">
                {CONDITIONS.map(c => (
                  <button key={c} type="button" className={`svc-pill${storeCondition === c ? ' is-active' : ''}`}
                    onClick={() => setStoreCondition(c)}>{c}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="svc-yn-grid" style={{ gridTemplateColumns: '1fr' }}>
            <YesNo label="Customer survey completed?" value={surveyDone} onChange={setSurveyDone} />
          </div>
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
            <label className="svc-label">Customer comments</label>
            <textarea className="svc-input svc-textarea" rows={2} placeholder="What did the customer say?" value={custComments} onChange={e => setCustComments(e.target.value)} />
          </div>
          <div className="svc-field">
            <label className="svc-label">Feedback reason</label>
            <input type="text" className="svc-input" placeholder="Why did they give that rating?" value={feedbackReason} onChange={e => setFeedbackReason(e.target.value)} />
          </div>
          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('photos')}>← Back</button>
            <button type="button" className="svc-next-btn" onClick={() => setActiveStep('close')}>Next: Close Visit →</button>
          </div>
        </div>
      );

      case 'close': return (
        <div className="svc-step-content">
          <div className="svc-step-heading">Close Visit</div>

          {/* Summary card */}
          <div className="svc-summary-card">
            <div className="svc-summary-row">
              <span className="svc-summary-label">Store</span>
              <span className="svc-summary-val">{visitMode === 'adhoc' ? adhocStore?.name : booking?.store_name}</span>
            </div>
            <div className="svc-summary-row">
              <span className="svc-summary-label">Ref</span>
              <span className="svc-summary-val svc-summary-ref">{visitMode === 'adhoc' ? adhocRef : booking?.report_ref}</span>
            </div>
            <div className="svc-summary-row">
              <span className="svc-summary-label">Check-in</span>
              <span className="svc-summary-val">{checkinTime}</span>
            </div>
            <div className="svc-summary-row">
              <span className="svc-summary-label">Photos</span>
              <span className="svc-summary-val">{Object.values(photoUrls).flat().length} uploaded</span>
            </div>
          </div>

          <div className="svc-field">
            <label className="svc-label">Check-out Time</label>
            <input type="time" className="svc-input svc-input-sm" value={checkoutTime} onChange={e => setCheckoutTime(e.target.value)} />
          </div>

          {isGazebo && (
            <div className="svc-field">
              <label className="svc-label">Gazebo Day Feedback</label>
              <textarea className="svc-input svc-textarea" rows={3} placeholder="Notes from the gazebo day event…" value={gazeboFeedback} onChange={e => setGazeboFeedback(e.target.value)} />
            </div>
          )}

          {error && <p className="svc-error">{error}</p>}

          <div className="svc-step-nav">
            <button type="button" className="svc-back-btn" onClick={() => setActiveStep('survey')}>← Back</button>
          </div>

          <button type="submit" className="svc-submit" disabled={busy || !checkinTime || !storeReady}>
            {busy ? 'Saving…' : '✓ Submit Visit Capture'}
          </button>
        </div>
      );
    }
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

        {/* ── Layout: nav rail + content pane ── */}
        <div className="svc-layout">

          {/* Left nav rail */}
          <nav className="svc-nav-rail" aria-label="Form sections">
            {STEPS.map((step, idx) => {
              const locked = !storeReady && step.id !== 'setup';
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`svc-nav-item${activeStep === step.id ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
                  onClick={() => !locked && setActiveStep(step.id)}
                  disabled={locked}
                  aria-current={activeStep === step.id ? 'step' : undefined}
                >
                  <span className="svc-nav-icon">{step.icon}</span>
                  <span className="svc-nav-label">{step.label}</span>
                  <span className="svc-nav-num">{idx + 1}</span>
                </button>
              );
            })}
          </nav>

          {/* Right content pane */}
          <div className="svc-content-pane">
            {renderStep()}
          </div>

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
            <button type="button" className="svc-photo-remove" onClick={() => onRemove(i)} aria-label="Remove photo">×</button>
          </div>
        ))}
        <div className="svc-photo-add-tile" onClick={() => inputRef.current?.click()}>
          {uploading
            ? <span className="svc-photo-status svc-uploading" style={{ fontSize: 20 }}>↑</span>
            : <><span className="svc-photo-icon">📷</span><span className="svc-photo-add-lbl">Add</span></>
          }
          <input ref={inputRef} type="file" accept="image/*" multiple capture="environment"
            style={{ display: 'none' }} onChange={handleChange} />
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;700;800;900&family=Barlow:wght@300;400;500;600&display=swap');

  /* ── Theme tokens ── */
  .svc-wrap.theme-dark {
    --p:#0D0D0B; --base:#1A1A18; --elev:#2E2E2C; --sunken:#0D0D0B;
    --nav:#111110; --nav-hover:#1A1A18;
    --yellow:#F5C400; --yellow-h:#FAE04D; --text:#E8E7E2; --muted:#949390; --dim:#5C5B58;
    --border:rgba(255,255,255,0.10); --border-s:rgba(255,255,255,0.06);
    --focus:#F5C400; --sel-bg:#F5C400; --sel-fg:#0D0D0B; --sel-bd:#F5C400;
    --danger-bg:rgba(232,96,96,0.12); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.30);
    --success-bg:rgba(45,140,122,0.12); --success-fg:#C8EDE7; --success-bd:rgba(45,140,122,0.30);
    --info-bg:rgba(26,61,110,0.30); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.30);
    --summary-bg:rgba(245,196,0,0.07); --summary-bd:rgba(245,196,0,0.20);
    --section-bg:rgba(245,196,0,0.06);
    background:var(--p); color:var(--text);
  }
  .svc-wrap.theme-light {
    --p:#F7F6F3; --base:#FFFFFF; --elev:#FFFFFF; --sunken:#F0EFEA;
    --nav:#E8E7E2; --nav-hover:#FFFFFF;
    --yellow:#F5C400; --yellow-h:#D4A800; --text:#0D0D0B; --muted:#5C5B58; --dim:#949390;
    --border:#C8C7C0; --border-s:#E8E7E2;
    --focus:#1A3D6E; --sel-bg:#F5C400; --sel-fg:#0D0D0B; --sel-bd:#A88000;
    --danger-bg:#FEF2F2; --danger-fg:#C0392B; --danger-bd:#E86060;
    --success-bg:#EDF7F5; --success-fg:#1a5c50; --success-bd:#2D8C7A;
    --info-bg:#E8EFF8; --info-fg:#1A3D6E; --info-bd:#B8CCE8;
    --summary-bg:rgba(245,196,0,0.10); --summary-bd:rgba(180,140,0,0.30);
    --section-bg:rgba(245,196,0,0.08);
    background:var(--p); color:var(--text);
  }
  .svc-wrap.theme-navy {
    --p:#071022; --base:#0D2040; --elev:#1A3D6E; --sunken:#071022;
    --nav:#050C18; --nav-hover:#0D2040;
    --yellow:#F5C400; --yellow-h:#FAE04D; --text:#FFFFFF; --muted:#B8CCE8; --dim:#6B9ED0;
    --border:rgba(107,158,208,0.20); --border-s:rgba(107,158,208,0.12);
    --focus:#F5C400; --sel-bg:#F5C400; --sel-fg:#071022; --sel-bd:#F5C400;
    --danger-bg:rgba(232,96,96,0.14); --danger-fg:#FDDCDC; --danger-bd:rgba(232,96,96,0.35);
    --success-bg:rgba(45,140,122,0.15); --success-fg:#C8EDE7; --success-bd:rgba(45,140,122,0.35);
    --info-bg:rgba(45,107,168,0.20); --info-fg:#B8CCE8; --info-bd:rgba(107,158,208,0.35);
    --summary-bg:rgba(245,196,0,0.08); --summary-bd:rgba(245,196,0,0.25);
    --section-bg:rgba(107,158,208,0.08);
    background:var(--p); color:var(--text);
  }

  /* ── Root layout ── */
  .svc-wrap {
    min-height:100vh; margin:0; padding:10px;
    box-sizing:border-box; font-family:'Barlow',sans-serif;
  }
  .svc-frame {
    height:calc(100vh - 20px); display:flex; flex-direction:column;
    border-radius:12px; overflow:hidden;
  }

  /* ── Header ── */
  .svc-header {
    display:flex; align-items:center; gap:12px; flex-shrink:0;
    background:var(--base); border-bottom:1px solid var(--border);
    padding:10px 16px;
  }
  .svc-logo-wrap { width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0; }
  .svc-logo-wrap img { display:block; width:100%; height:100%; object-fit:cover; }
  .svc-title-block { line-height:1; }
  .svc-eyebrow {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px;
    text-transform:uppercase; letter-spacing:0.12em; color:var(--dim);
  }
  h1 {
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:22px;
    text-transform:uppercase; color:var(--yellow); margin:2px 0 0; line-height:1;
  }
  .svc-theme-toggle {
    display:flex; gap:3px; background:var(--sunken); border-radius:8px; padding:3px; margin-left:auto;
  }
  .svc-theme-btn {
    background:transparent; border:0; color:var(--muted); border-radius:6px; padding:8px 14px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer; min-height:36px;
    transition:background 0.12s,color 0.12s;
  }
  .svc-theme-btn:hover { background:var(--elev); color:var(--text); }
  .svc-theme-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); font-weight:900; }
  .svc-theme-btn:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }

  /* ── Two-pane layout ── */
  .svc-layout {
    display:grid; grid-template-columns:172px 1fr;
    flex:1; min-height:0; overflow:hidden;
  }

  /* ── Nav rail ── */
  .svc-nav-rail {
    background:var(--nav); border-right:1px solid var(--border);
    display:flex; flex-direction:column; gap:2px; padding:10px 6px;
    overflow-y:auto;
  }
  .svc-nav-item {
    display:flex; align-items:center; gap:8px;
    background:transparent; border:0; border-radius:8px;
    padding:10px 10px; width:100%; text-align:left; cursor:pointer;
    color:var(--muted); transition:background 0.12s,color 0.12s;
    position:relative;
  }
  .svc-nav-item:hover:not(:disabled) { background:var(--nav-hover); color:var(--text); }
  .svc-nav-item.is-active {
    background:var(--sel-bg); color:var(--sel-fg);
  }
  .svc-nav-item.is-locked { opacity:0.35; cursor:not-allowed; }
  .svc-nav-item:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }
  .svc-nav-icon { font-size:16px; flex-shrink:0; width:20px; text-align:center; }
  .svc-nav-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.06em; flex:1; line-height:1.2;
  }
  .svc-nav-item.is-active .svc-nav-label { color:var(--sel-fg); }
  .svc-nav-num {
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:10px;
    color:var(--dim); flex-shrink:0;
  }
  .svc-nav-item.is-active .svc-nav-num { color:var(--sel-fg); opacity:0.6; }

  /* ── Content pane ── */
  .svc-content-pane {
    background:var(--base); overflow-y:auto; padding:18px 22px 24px;
  }
  .svc-step-content { display:flex; flex-direction:column; gap:14px; }
  .svc-step-heading {
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px;
    text-transform:uppercase; color:var(--yellow); margin:0 0 4px;
    border-bottom:1px solid var(--border); padding-bottom:10px;
  }

  /* ── Fields ── */
  .svc-field { display:flex; flex-direction:column; gap:7px; }
  .svc-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
  }
  .svc-req { color:var(--yellow); }
  .svc-input {
    width:100%; box-sizing:border-box; padding:11px 14px; min-height:46px;
    font-size:15px; font-family:'Barlow',sans-serif;
    background:var(--sunken); color:var(--text);
    border:1px solid var(--border); border-radius:8px; appearance:none; -webkit-appearance:none;
    transition:border-color 0.12s;
  }
  .svc-input:focus { outline:none; border-color:var(--yellow); box-shadow:0 0 0 3px rgba(245,196,0,0.18); }
  .svc-input-sm { max-width:180px; }
  .svc-input-readonly { color:var(--muted); cursor:default; }
  .svc-input-readonly:focus { border-color:var(--border); box-shadow:none; }
  .svc-textarea { min-height:80px; resize:vertical; }

  /* ── Mode toggle ── */
  .svc-mode-toggle { display:flex; gap:4px; background:var(--sunken); border-radius:10px; padding:4px; }
  .svc-mode-btn {
    flex:1; padding:11px 16px; min-height:46px;
    background:transparent; border:0; color:var(--muted);
    border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;
    transition:background 0.12s,color 0.12s;
  }
  .svc-mode-btn:hover { background:var(--elev); color:var(--text); }
  .svc-mode-btn.is-active { background:var(--yellow); color:var(--sunken); font-weight:900; }
  .svc-mode-btn:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }

  /* ── Store search ── */
  .svc-hint { margin:4px 0 0; font-size:12px; color:var(--dim); }
  .svc-store-list {
    list-style:none; margin:4px 0 0; padding:0;
    background:var(--elev); border:1px solid var(--border);
    border-radius:8px; overflow:hidden; position:absolute;
    left:0; right:0; z-index:20; box-shadow:0 4px 16px rgba(0,0,0,0.3);
  }
  .svc-store-item {
    display:flex; align-items:baseline; gap:8px; flex-wrap:wrap;
    padding:12px 14px; cursor:pointer;
    border-bottom:1px solid var(--border-s);
    transition:background 0.1s;
  }
  .svc-store-item:last-child { border-bottom:0; }
  .svc-store-item:hover { background:var(--section-bg); }
  .svc-store-name { font-size:14px; color:var(--text); font-weight:500; }
  .svc-store-meta {
    font-family:'Barlow Condensed',sans-serif; font-size:10px;
    color:var(--dim); text-transform:uppercase; letter-spacing:0.06em;
  }

  /* ── Booking card ── */
  .svc-booking-card {
    background:var(--info-bg); border:1px solid var(--info-bd);
    border-radius:8px; padding:12px 14px;
    display:flex; flex-direction:column; gap:5px;
  }
  .svc-booking-row { display:flex; gap:8px; align-items:baseline; }
  .svc-booking-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px;
    text-transform:uppercase; letter-spacing:0.1em; color:var(--info-fg); min-width:60px;
  }
  .svc-booking-val { font-size:14px; color:var(--info-fg); }

  /* ── Summary card ── */
  .svc-summary-card {
    background:var(--summary-bg); border:1px solid var(--summary-bd);
    border-radius:10px; padding:14px 18px;
    display:flex; flex-direction:column; gap:6px;
  }
  .svc-summary-row { display:flex; gap:10px; align-items:baseline; }
  .svc-summary-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px;
    text-transform:uppercase; letter-spacing:0.1em; color:var(--dim); min-width:64px;
  }
  .svc-summary-val { font-size:14px; color:var(--text); }
  .svc-summary-ref { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:16px; color:var(--yellow); }

  /* ── Clear / nav buttons ── */
  .svc-clear-btn {
    align-self:flex-start; padding:8px 16px; min-height:38px;
    background:var(--elev); color:var(--muted);
    border:1px solid var(--border); border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; letter-spacing:0.06em; cursor:pointer;
    transition:color 0.12s;
  }
  .svc-clear-btn:hover { color:var(--text); }
  .svc-step-nav { display:flex; gap:8px; justify-content:space-between; margin-top:6px; }
  .svc-back-btn {
    padding:11px 20px; min-height:46px; flex-shrink:0;
    background:var(--sunken); color:var(--muted);
    border:1px solid var(--border); border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;
    transition:color 0.12s;
  }
  .svc-back-btn:hover { color:var(--text); }
  .svc-next-btn {
    flex:1; padding:11px 20px; min-height:46px;
    background:var(--yellow); color:var(--sunken);
    border:0; border-radius:8px;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:13px;
    text-transform:uppercase; letter-spacing:0.08em; cursor:pointer;
    transition:background 0.12s;
  }
  .svc-next-btn:hover { background:var(--yellow-h); }
  .svc-next-btn:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }

  /* ── Yes/No ── */
  .svc-yn-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .svc-yn-field {
    display:flex; flex-direction:column; gap:8px;
    background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:12px 14px;
  }
  .svc-yn-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); line-height:1.3;
  }
  .svc-yn-btns { display:flex; gap:6px; }
  .svc-yn-btn {
    flex:1; padding:10px; min-height:44px; border-radius:7px;
    border:1px solid var(--border); background:var(--elev); color:var(--text);
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:14px;
    text-transform:uppercase; cursor:pointer; transition:background 0.1s,border-color 0.1s;
  }
  .svc-yn-yes.is-active { background:var(--success-bg); color:var(--success-fg); border-color:var(--success-bd); }
  .svc-yn-no.is-active  { background:var(--danger-bg);  color:var(--danger-fg);  border-color:var(--danger-bd);  }

  /* ── Merch stepper ── */
  .svc-merch-grid { display:flex; flex-direction:column; gap:6px; }
  .svc-merch-row {
    display:flex; align-items:center; justify-content:space-between;
    background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:11px 16px;
  }
  .svc-merch-label { font-size:14px; color:var(--text); }
  .svc-stepper { display:flex; align-items:center; gap:0; }
  .svc-step-btn {
    width:40px; height:40px; border-radius:7px; border:1px solid var(--border);
    background:var(--elev); color:var(--text); font-size:20px; line-height:1;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    transition:background 0.1s;
  }
  .svc-step-btn:hover { background:var(--section-bg); border-color:var(--yellow); }
  .svc-step-val {
    min-width:44px; text-align:center;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:20px;
    color:var(--yellow);
  }

  /* ── Photo slots ── */
  .svc-photo-sections { display:flex; flex-direction:column; gap:10px; }
  .svc-photo-slot {
    background:var(--sunken); border:1px solid var(--border-s); border-radius:10px; padding:10px 12px;
  }
  .svc-photo-slot-header {
    display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;
  }
  .svc-photo-slot-label {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
  }
  .svc-photo-slot-count {
    font-family:'Barlow Condensed',sans-serif; font-size:10px; color:var(--yellow); font-weight:700;
  }
  .svc-photo-row { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; }
  .svc-photo-thumb {
    position:relative; width:88px; height:88px; border-radius:8px; overflow:hidden; flex-shrink:0;
  }
  .svc-photo-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
  .svc-photo-remove {
    position:absolute; top:3px; right:3px;
    width:22px; height:22px; border-radius:50%;
    background:rgba(0,0,0,0.65); color:#fff; border:0;
    font-size:15px; line-height:1; cursor:pointer;
    display:flex; align-items:center; justify-content:center; padding:0;
  }
  .svc-photo-remove:hover { background:rgba(232,96,96,0.85); }
  .svc-photo-add-tile {
    width:88px; height:88px; border-radius:8px;
    border:2px dashed var(--border); background:var(--elev);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
    cursor:pointer; flex-shrink:0;
    transition:border-color 0.12s;
  }
  .svc-photo-add-tile:hover { border-color:var(--yellow); }
  .svc-photo-icon { font-size:24px; }
  .svc-photo-add-lbl {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px;
    text-transform:uppercase; letter-spacing:0.06em; color:var(--dim);
  }
  .svc-photo-status { font-size:13px; font-weight:700; }
  .svc-uploading { color:var(--yellow); animation:spin 1s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }

  /* ── Ratings ── */
  .svc-ratings-table { display:flex; flex-direction:column; gap:4px; }
  .svc-ratings-header {
    display:grid; grid-template-columns:1fr repeat(3,90px); gap:4px; padding:0 4px;
  }
  .svc-rating-col-head {
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:9px;
    text-transform:uppercase; letter-spacing:0.08em; color:var(--dim); text-align:center;
  }
  .svc-rating-row {
    display:grid; grid-template-columns:1fr repeat(3,90px); gap:4px;
    align-items:center; background:var(--sunken); border:1px solid var(--border-s);
    border-radius:8px; padding:8px 10px;
  }
  .svc-rating-label { font-size:13px; color:var(--text); }
  .svc-rating-btn {
    width:100%; min-height:40px; border-radius:6px; border:1px solid var(--border);
    background:var(--elev); color:var(--muted); font-size:16px;
    cursor:pointer; transition:background 0.1s,color 0.1s;
  }
  .svc-rating-btn.is-active { background:var(--sel-bg); color:var(--sel-fg); border-color:var(--sel-bd); }

  /* ── Pills ── */
  .svc-pill-grid { display:flex; flex-wrap:wrap; gap:6px; }
  .svc-pill {
    background:var(--sunken); border:1px solid var(--border); color:var(--text);
    border-radius:8px; padding:9px 16px; min-height:42px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:13px;
    text-transform:uppercase; cursor:pointer; transition:background 0.1s,border-color 0.1s;
  }
  .svc-pill:hover { border-color:var(--yellow); }
  .svc-pill.is-active { background:var(--sel-bg); color:var(--sel-fg); border-color:var(--sel-bd); font-weight:900; }

  /* ── Two-col layout ── */
  .svc-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }

  /* ── Error ── */
  .svc-error {
    color:var(--danger-fg); background:var(--danger-bg); border:1px solid var(--danger-bd);
    padding:10px 14px; border-radius:8px; font-size:13px; margin:0;
  }

  /* ── Submit ── */
  .svc-submit {
    width:100%; padding:15px; min-height:54px;
    background:var(--yellow); color:var(--sunken); border:0; border-radius:10px;
    font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:17px;
    text-transform:uppercase; letter-spacing:0.1em; cursor:pointer;
    transition:background 0.15s,opacity 0.15s; display:block;
  }
  .svc-submit:hover:not(:disabled) { background:var(--yellow-h); }
  .svc-submit:disabled { opacity:0.45; cursor:not-allowed; }

  /* ── Thanks ── */
  .svc-thanks {
    max-width:520px; margin:60px auto; background:var(--base);
    border:1px solid var(--border); border-radius:12px; padding:40px 28px;
    text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.3);
    display:flex; flex-direction:column; align-items:center;
  }
  .svc-check { font-size:52px; color:#2D8C7A; margin-bottom:16px; }
  .svc-ref { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:22px; color:var(--yellow); margin:8px 0; }
  .svc-sub { color:var(--muted); font-size:15px; line-height:1.6; margin-top:12px; }

  /* ── Phone fallback: stack panes ── */
  @media (max-width:700px) {
    .svc-wrap { padding:0; }
    .svc-frame { height:auto; border-radius:0; }
    .svc-header { flex-wrap:wrap; padding:10px 12px; }
    .svc-layout { grid-template-columns:1fr; }
    .svc-nav-rail {
      flex-direction:row; flex-wrap:wrap; border-right:0;
      border-bottom:1px solid var(--border); padding:6px;
    }
    .svc-nav-item { width:auto; padding:8px 10px; }
    .svc-nav-label { display:none; }
    .svc-nav-num { display:none; }
    .svc-content-pane { padding:14px 12px 32px; }
    .svc-yn-grid { grid-template-columns:1fr; }
    .svc-row-2 { grid-template-columns:1fr; }
    .svc-ratings-header { grid-template-columns:1fr repeat(3,60px); }
    .svc-rating-row { grid-template-columns:1fr repeat(3,60px); }
    .svc-input { font-size:16px; }
    .svc-thanks { margin:24px 12px; padding:28px 16px; }
  }
`;
