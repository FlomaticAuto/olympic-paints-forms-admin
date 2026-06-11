'use client';
import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';

type Theme = 'theme-dark' | 'theme-light' | 'theme-navy';
const THEME_KEY = 'svc-theme';

const RATINGS = ['Not Satisfied', 'Somewhat Satisfied', 'Satisfied'] as const;
type Rating = typeof RATINGS[number];
const CONDITIONS = ['Poor', 'Fair', 'Good', 'Excellent'] as const;
type Condition = typeof CONDITIONS[number];

interface Booking {
  store_name: string;
  store_address: string | null;
  visit_date: string;
  purpose: string;
  tasks: string[];
  merchandiser: string;
}

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

export default function StoreVisitCaptureForm() {
  const [theme, setThemeState] = useState<Theme>('theme-dark');
  useEffect(() => {
    const s = window.localStorage.getItem(THEME_KEY);
    if (s === 'theme-light' || s === 'theme-navy' || s === 'theme-dark') setThemeState(s as Theme);
  }, []);
  const setTheme = (t: Theme) => { setThemeState(t); window.localStorage.setItem(THEME_KEY, t); };

  // Step 0: SVB ref lookup
  const [svbRef,      setSvbRef]      = useState('');
  const [booking,     setBooking]     = useState<Booking | null>(null);
  const [lookupBusy,  setLookupBusy]  = useState(false);
  const [lookupErr,   setLookupErr]   = useState<string | null>(null);

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

  // Section 5: photos
  const [photoFiles,    setPhotoFiles]    = useState<Record<string, File | null>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, null]))
  );
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, '']))
  );
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, false]))
  );
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(
    Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, '']))
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

  const isGazebo = booking?.purpose?.toLowerCase().includes('gazebo');

  // ── Lookup booking by SVB ref ─────────────────────────────────────────────
  async function lookupBooking() {
    const ref = svbRef.trim().toUpperCase();
    if (!ref) return;
    setLookupBusy(true);
    setLookupErr(null);
    try {
      const res = await fetch(`/api/visit-capture/lookup?ref=${encodeURIComponent(ref)}`);
      const j = await res.json();
      if (!res.ok || !j.booking) {
        setLookupErr(j.error ?? 'Booking not found. Check the ref and try again.');
        setBooking(null);
      } else {
        setBooking(j.booking);
        setCheckinTime(nowLocal());
      }
    } catch {
      setLookupErr('Network error — please try again.');
    } finally {
      setLookupBusy(false);
    }
  }

  // ── Photo select + immediate upload ──────────────────────────────────────
  async function handlePhoto(key: string, file: File | null) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhotoFiles(p => ({ ...p, [key]: file }));
    setPhotoPreviews(p => ({ ...p, [key]: preview }));
    setPhotoUploading(p => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      fd.append('ref', svbRef.trim().toUpperCase());
      const res = await fetch('/api/visit-capture/upload-photo', { method: 'POST', body: fd });
      const j = await res.json();
      if (res.ok && j.url) {
        setPhotoUrls(p => ({ ...p, [key]: j.url }));
      }
    } catch {
      // non-fatal — URL stays empty, we can submit without it
    } finally {
      setPhotoUploading(p => ({ ...p, [key]: false }));
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!booking) return;
    setBusy(true);
    setError(null);

    const payload = {
      report_ref:                svbRef.trim().toUpperCase(),
      store_name:                booking.store_name,
      store_address:             booking.store_address ?? '',
      visit_date:                booking.visit_date,
      merchandiser:              booking.merchandiser,

      checked_stock_location:    checkedStock,
      checked_fifo:              checkedFifo,
      stock_on_floor_sufficient: stockSufficient,
      replenishment_order_placed:replenishment,
      rep_servicing_store:       repName.trim() || null,

      ...Object.fromEntries(MERCH_ITEMS.map(m => [m.key, merchCounts[m.key] || 0])),
      other_merch_items:         otherMerch.trim() || null,

      all_colour_charts_in_place: chartsInPlace,

      ...Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, photoUrls[p.key] || null])),

      spoke_to:                  spokeTo.trim() || null,
      customer_survey_completed: surveyDone,
      ...Object.fromEntries(SURVEY_ROWS.map(r => [r.key, ratings[r.key] || null])),
      customer_comments:         custComments.trim() || null,
      customer_feedback_reason:  feedbackReason.trim() || null,
      overall_store_condition:   storeCondition || null,

      checked_in_at:  booking.visit_date + 'T' + checkinTime + ':00',
      checked_out_at: checkoutTime ? booking.visit_date + 'T' + checkoutTime + ':00' : null,
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
          <p className="svc-ref">{svbRef.trim().toUpperCase()}</p>
          <p className="svc-sub">Store visit for <strong>{booking?.store_name}</strong> has been recorded.</p>
          <button className="svc-submit" style={{ marginTop: 24 }} onClick={() => {
            setDone(false); setBooking(null); setSvbRef('');
            setCheckedStock(null); setCheckedFifo(null); setStockSufficient(null);
            setReplenishment(null); setRepName(''); setMerchCounts(Object.fromEntries(MERCH_ITEMS.map(m => [m.key, 0])));
            setOtherMerch(''); setChartsInPlace(null);
            setPhotoFiles(Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, null])));
            setPhotoPreviews(Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, ''])));
            setPhotoUrls(Object.fromEntries(PHOTO_FIELDS.map(p => [p.key, ''])));
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

          {/* ── Section 1: Booking lookup ── */}
          <div className="svc-section-label">Booking Reference</div>
          <div className="svc-field">
            <label className="svc-label" htmlFor="svc-ref">SVB Reference <span className="svc-req">*</span></label>
            <div className="svc-lookup-row">
              <input
                id="svc-ref"
                type="text"
                className="svc-input"
                placeholder="e.g. SVB-260603-1234"
                value={svbRef}
                onChange={e => { setSvbRef(e.target.value.toUpperCase()); setBooking(null); setLookupErr(null); }}
                disabled={!!booking}
                autoCapitalize="characters"
              />
              {!booking
                ? <button type="button" className="svc-lookup-btn" onClick={lookupBooking} disabled={svbRef.length < 5 || lookupBusy}>
                    {lookupBusy ? '…' : 'Load'}
                  </button>
                : <button type="button" className="svc-lookup-clear" onClick={() => { setBooking(null); setSvbRef(''); setLookupErr(null); }}>
                    Change
                  </button>
              }
            </div>
            {lookupErr && <p className="svc-error svc-error-inline">{lookupErr}</p>}
          </div>

          {booking && (
            <>
              {/* Booking card */}
              <div className="svc-booking-card">
                <div className="svc-booking-row"><span className="svc-booking-label">Store</span><span className="svc-booking-val">{booking.store_name}</span></div>
                {booking.store_address && <div className="svc-booking-row"><span className="svc-booking-label">Address</span><span className="svc-booking-val">{booking.store_address}</span></div>}
                <div className="svc-booking-row"><span className="svc-booking-label">Date</span><span className="svc-booking-val">{booking.visit_date}</span></div>
                <div className="svc-booking-row"><span className="svc-booking-label">Purpose</span><span className="svc-booking-val">{booking.purpose}</span></div>
                {booking.tasks.length > 0 && <div className="svc-booking-row"><span className="svc-booking-label">Tasks</span><span className="svc-booking-val">{booking.tasks.join(', ')}</span></div>}
              </div>

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
                <input id="svc-rep" type="text" className="svc-input" placeholder="Rep name" value={repName} onChange={e => setRepName(e.target.value)} />
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
              <div className="svc-photo-grid">
                {PHOTO_FIELDS.map(f => (
                  <PhotoUpload
                    key={f.key}
                    label={f.label}
                    preview={photoPreviews[f.key]}
                    uploading={photoUploading[f.key]}
                    uploaded={!!photoUrls[f.key]}
                    onChange={file => handlePhoto(f.key, file)}
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

function PhotoUpload({ label, preview, uploading, uploaded, onChange }: {
  label: string; preview: string; uploading: boolean; uploaded: boolean;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }
  return (
    <div className="svc-photo-cell" onClick={() => inputRef.current?.click()}>
      {preview
        ? <img src={preview} alt={label} className="svc-photo-preview" />
        : <div className="svc-photo-placeholder">
            <span className="svc-photo-icon">📷</span>
            <span className="svc-photo-add">Tap to add</span>
          </div>
      }
      <div className="svc-photo-label-row">
        <span className="svc-photo-label">{label}</span>
        {uploading && <span className="svc-photo-status svc-uploading">↑</span>}
        {!uploading && uploaded && <span className="svc-photo-status svc-uploaded">✓</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleChange} />
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
  .svc-textarea { min-height:72px; resize:vertical; }

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

  /* Photo grid */
  .svc-photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .svc-photo-cell {
    cursor:pointer; border-radius:10px; overflow:hidden;
    border:2px dashed var(--border); background:var(--sunken);
    display:flex; flex-direction:column; min-height:120px;
    transition:border-color 0.12s;
  }
  .svc-photo-cell:hover { border-color:var(--yellow); }
  .svc-photo-preview { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
  .svc-photo-placeholder {
    flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
    padding:12px;
  }
  .svc-photo-icon { font-size:28px; }
  .svc-photo-add { font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:0.06em; font-family:'Barlow Condensed',sans-serif; font-weight:700; }
  .svc-photo-label-row { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:var(--elev); }
  .svc-photo-label { font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); }
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
    .svc-photo-grid { grid-template-columns:repeat(2,1fr); }
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
