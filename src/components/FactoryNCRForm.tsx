'use client';
import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { CATEGORIES, PRODUCT_DATA } from '@/lib/returnProductData';
import { COLOUR_HEX, getColourHex } from '@/lib/returnColourHex';
import { pickContrastColour, needsSwatchBorder } from '@/lib/uiHelpers';

interface Props { formId: string; }

type Theme = 'theme-dark' | 'theme-light' | 'theme-max';
const THEME_STORAGE_KEY = 'factory-ncr-theme';

const NC_TYPES = [
  'Wrong Labeling',
  'Faulty Bucket / Packaging',
  'Material Issue',
  'Equipment Fault',
  'Process Deviation',
  'Other',
];

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

const LOCATIONS = [
  'Production',
  'Dispatch',
  'Warehouse / Storage',
  'Resin Plant',
  'Yard / External',
  'Other',
];

const SUPERVISORS = ['Sigma', 'Production Supervisor', 'Other'];

function generateRef(): string {
  const now = new Date();
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FNCR-${yymmdd}-${rand}`;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FactoryNCRForm({ formId }: Props) {
  const [reportRef]  = useState<string>(() => generateRef());
  const [theme, setThemeState] = useState<Theme>('theme-dark');

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'theme-light' || saved === 'theme-max' || saved === 'theme-dark') {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  const [ncType,      setNcType]      = useState('');
  const [severity,    setSeverity]    = useState('');
  const [location,    setLocation]    = useState('');
  const [category,    setCategory]    = useState('');
  const [product,     setProduct]     = useState('');
  const [colour,      setColour]      = useState('');
  const [batchNo,     setBatchNo]     = useState('');
  const [supervisor,  setSupervisor]  = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl,    setPhotoUrl]    = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const date = todayLocal();

  const categoryEntry = CATEGORIES.find(c => c.label === category);
  const productList   = categoryEntry?.products ?? [];
  const productInfo   = product ? PRODUCT_DATA[product] : null;
  const colourList    = productInfo?.colours ?? [];
  const colourIsNA    = colourList.length === 1 && colourList[0] === 'N/A';

  function handleCategoryChange(val: string) {
    setCategory(val);
    setProduct('');
    setColour('');
  }

  function handleProductChange(val: string) {
    setProduct(val);
    const info = val ? PRODUCT_DATA[val] : null;
    const colours = info?.colours ?? [];
    setColour(colours.length === 1 && colours[0] === 'N/A' ? 'N/A' : '');
  }

  const canSubmit = Boolean(
    ncType && severity && location && category && product && colour && supervisor && description.trim() && !photoUploading
  );

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setPhotoUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', 'evidence');
      fd.append('ref', reportRef);
      const res = await fetch('/api/factory-ncr/upload-photo', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Photo upload failed');
      setPhotoUrl(j.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const data = {
      report_ref: reportRef,
      date,
      nc_type: ncType,
      severity,
      location,
      category,
      product,
      colour,
      batch_no: batchNo,
      supervisor,
      description,
      photo_url: photoUrl ?? '',
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data,
          metadata: { form_type: 'factory_ncr', report_ref: reportRef },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? 'Submission failed. Please try again.');
        setBusy(false);
        return;
      }
      fetch('/api/factory-ncr-notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => { /* silent */ });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className={`ri-wrap ${theme}`}>
        <div className="ri-thanks">
          <div className="ri-check">✓</div>
          <h1>Non-Conformance Logged</h1>
          <p className="ri-ref">{reportRef}</p>
          <p className="ri-sub">Your report has been recorded. The supervisor has been notified.</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  return (
    <main className={`ri-wrap ${theme}`}>
      <form onSubmit={onSubmit} className="ri-frame">

        {/* Header */}
        <header className="ri-header">
          <div className="ri-logo-wrap">
            <img src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg" alt="Olympic Paints" width={36} height={36} />
          </div>
          <div className="ri-title-block">
            <div className="ri-eyebrow">Olympic Paints</div>
            <h1>Factory Non-Conformance</h1>
          </div>
          <div className="ri-meta">
            <div className="ri-meta-item">
              <span className="ri-meta-label">Report No.</span>
              <span className="ri-meta-val">{reportRef}</span>
            </div>
            <div className="ri-meta-item">
              <span className="ri-meta-label">Date</span>
              <span className="ri-meta-val">{date}</span>
            </div>
          </div>
          <div className="ri-theme-toggle" role="group" aria-label="Display theme">
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-dark' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-dark'}
              onClick={() => setTheme('theme-dark')}
            >Dark</button>
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-light' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-light'}
              onClick={() => setTheme('theme-light')}
            >Light</button>
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-max' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-max'}
              onClick={() => setTheme('theme-max')}
            >Max</button>
          </div>
        </header>

        <div className="ri-panes">

          {/* PANE 1 — Category + Product */}
          <section className="ri-pane">
            <div className="ri-step-label">1 · Category</div>
            <CategoryGrid value={category} onChange={handleCategoryChange} />
            {category && (
              <>
                <div className="ri-step-label">2 · Product</div>
                <ProductList products={productList} value={product} onChange={handleProductChange} />
              </>
            )}
          </section>

          {/* PANE 2 — Colour */}
          <section className="ri-pane">
            <div className="ri-step-label">
              3 · Colour{product && !colourIsNA && <span className="ri-step-sub"> — {colourList.length} available</span>}
            </div>
            {!product && <EmptyHint text="Pick a product to see colours" />}
            {product && colourIsNA && (
              <div className="ri-na">Not applicable for this product</div>
            )}
            {product && !colourIsNA && (
              <ColourSwatchGrid colours={colourList} value={colour} onChange={setColour} />
            )}
          </section>

          {/* PANE 3 — Type + Severity + Location + Batch + Supervisor */}
          <section className="ri-pane">
            <div className="ri-step-label">4 · Type of Issue</div>
            <ButtonGrid cols={1} options={NC_TYPES} value={ncType} onChange={setNcType} wide />

            <div className="ri-step-label">5 · Severity</div>
            <ButtonGrid cols={2} options={SEVERITIES} value={severity} onChange={setSeverity} />

            <div className="ri-step-label">6 · Location</div>
            <ButtonGrid cols={1} options={LOCATIONS} value={location} onChange={setLocation} wide />

            <div className="ri-step-label">7 · Batch Number</div>
            <input
              type="text"
              className="ri-input"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              placeholder="e.g. BT-2026-0042 (if known)"
            />

            <div className="ri-step-label">8 · Supervisor</div>
            <ButtonGrid cols={1} options={SUPERVISORS} value={supervisor} onChange={setSupervisor} wide />
          </section>

          {/* PANE 4 — Description + Photo + Submit */}
          <section className="ri-pane">
            <div className="ri-step-label">9 · Description</div>
            <textarea
              className="ri-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What happened? What was wrong with the labeling / bucket / material?"
              rows={4}
              required
            />

            <div className="ri-step-label">10 · Photo Evidence</div>
            <PhotoSlot url={photoUrl} uploading={photoUploading} onAdd={handlePhoto} onRemove={() => setPhotoUrl(null)} />

            {error && <p className="ri-error">{error}</p>}

            <button type="submit" disabled={!canSubmit || busy} className="ri-submit">
              {busy ? 'Submitting…' : '✓ Log Non-Conformance'}
            </button>
          </section>

        </div>
      </form>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function EmptyHint({ text }: { text: string }) {
  return <div className="ri-empty">{text}</div>;
}

function CategoryGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-cat-grid">
      {CATEGORIES.map(c => (
        <button
          key={c.label}
          type="button"
          className={`ri-btn ${value === c.label ? 'is-active' : ''}`}
          aria-pressed={value === c.label}
          onClick={() => onChange(c.label)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function ProductList({ products, value, onChange }: { products: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-prod-list">
      {products.map(p => (
        <button
          key={p}
          type="button"
          className={`ri-btn ri-btn-wide ${value === p ? 'is-active' : ''}`}
          aria-pressed={value === p}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ColourSwatchGrid({ colours, value, onChange }: { colours: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-swatch-grid">
      {colours.map(name => {
        const hex = getColourHex(name);
        const fg  = pickContrastColour(hex);
        const needsBorder = needsSwatchBorder(hex);
        const isMissing = !(name in COLOUR_HEX);
        return (
          <button
            key={name}
            type="button"
            className={`ri-swatch ${value === name ? 'is-selected' : ''} ${needsBorder ? 'has-border' : ''}`}
            style={{ background: hex, color: fg }}
            aria-pressed={value === name}
            title={isMissing ? `${name} — hex not yet set` : name}
            onClick={() => onChange(name)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function ButtonGrid({ options, value, onChange, cols, wide }: {
  options: string[]; value: string; onChange: (v: string) => void; cols: number; wide?: boolean;
}) {
  return (
    <div className={cols === 2 ? 'ri-grid-2' : 'ri-prod-list'}>
      {options.map(o => (
        <button
          key={o}
          type="button"
          className={`ri-btn ${wide ? 'ri-btn-wide' : ''} ${value === o ? 'is-active' : ''}`}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function PhotoSlot({ url, uploading, onAdd, onRemove }: {
  url: string | null;
  uploading: boolean;
  onAdd: (f: File | null) => void;
  onRemove: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    onAdd(file);
    e.target.value = '';
  }

  return (
    <div className="ri-photo-block">
      {uploading ? (
        <div className="ri-photo-uploading">Uploading…</div>
      ) : url ? (
        <div className="ri-photo-preview-wrap">
          <img src={url} alt="Evidence" className="ri-photo-preview" />
          <button type="button" className="ri-photo-remove" onClick={onRemove} aria-label="Remove photo">×</button>
        </div>
      ) : (
        <div className="ri-photo-add-group">
          <button type="button" className="ri-photo-add-btn" onClick={() => cameraRef.current?.click()}>
            <span className="ri-photo-icon">📷</span>
            <span>Take Photo</span>
          </button>
          <button type="button" className="ri-photo-add-btn" onClick={() => galleryRef.current?.click()}>
            <span className="ri-photo-icon">🖼</span>
            <span>Choose File</span>
          </button>
        </div>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleChange} />
      <input ref={galleryRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleChange} />
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const css = `
  :root,
  .ri-wrap.theme-dark {
    --r-page: #0D2040;
    --r-pane: #1A3D6E;
    --r-pane-sunken: #071022;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #FFFFFF;
    --r-text-muted: #B8CCE8;
    --r-text-dim: #6B9ED0;
    --r-border: rgba(107,158,208,0.45);
    --r-border-soft: rgba(107,158,208,0.25);
    --r-danger-bg: rgba(232,96,96,0.14);
    --r-danger-fg: #FDDCDC;
    --r-danger-bd: rgba(232,96,96,0.35);
    --r-focus: var(--r-yellow);
    --r-selected-bg: var(--r-yellow);
    --r-selected-fg: var(--r-page);
    --r-selected-bd: var(--r-yellow);
  }

  .ri-wrap.theme-light {
    --r-page: #FAFAF7;
    --r-pane: #FFFFFF;
    --r-pane-sunken: #F0EFEA;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #0A0A08;
    --r-text-muted: #3D3D3A;
    --r-text-dim: #5C5B58;
    --r-border: #5C5B58;
    --r-border-soft: #B0AFAB;
    --r-danger-bg: #FCE8EC;
    --r-danger-fg: #B00020;
    --r-danger-bd: #B00020;
    --r-focus: #0046B8;
    --r-selected-bg: #F5C400;
    --r-selected-fg: #0A0A08;
    --r-selected-bd: #6A5000;
  }

  .ri-wrap.theme-max {
    --r-page: #F5C400;
    --r-pane: #FFFFFF;
    --r-pane-sunken: #FAE04D;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #000000;
    --r-text-muted: #2E2E2C;
    --r-text-dim: #5C5B58;
    --r-border: #000000;
    --r-border-soft: #5C5B58;
    --r-danger-bg: #FFFFFF;
    --r-danger-fg: #B00020;
    --r-danger-bd: #B00020;
    --r-focus: #0046B8;
    --r-selected-bg: #000000;
    --r-selected-fg: #F5C400;
    --r-selected-bd: #000000;
  }

  .ri-wrap {
    background: var(--r-page);
    min-height: 100vh;
    margin: 0;
    padding: 12px;
    font-family: 'Barlow', sans-serif;
    color: var(--r-text);
    box-sizing: border-box;
  }
  .ri-frame {
    background: var(--r-page);
    border-radius: 12px;
    padding: 0;
    height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .ri-header {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--r-pane);
    border-radius: 10px;
    padding: 10px 16px;
    margin-bottom: 10px;
  }
  .ri-logo-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }
  .ri-logo-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .ri-title-block { line-height: 1; }
  .ri-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--r-text-dim);
  }
  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    text-transform: uppercase;
    color: var(--r-yellow);
    margin: 2px 0 0;
    line-height: 1;
  }
  .ri-meta { margin-left: auto; display: flex; gap: 18px; }
  .ri-meta-item { text-align: right; line-height: 1.1; }
  .ri-meta-label {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--r-text-dim);
  }
  .ri-meta-val {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 16px;
    color: var(--r-yellow);
    margin-top: 2px;
  }

  /* ── Panes ── */
  .ri-panes {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1.1fr;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }
  .ri-pane {
    background: var(--r-pane);
    border-radius: 10px;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .ri-step-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--r-yellow);
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ri-step-label + .ri-step-label { margin-top: 14px; }

  /* ── Buttons (shared) ── */
  .ri-btn {
    background: var(--r-page);
    border: 1px solid var(--r-border);
    color: var(--r-text);
    border-radius: 8px;
    padding: 11px 6px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    line-height: 1.15;
    min-height: 44px;
  }
  .ri-btn:hover { background: var(--r-pane); }
  .ri-btn:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
  }
  .ri-btn.is-active {
    background: var(--r-selected-bg);
    color: var(--r-selected-fg);
    border-color: var(--r-selected-bd);
    font-weight: 900;
  }
  .ri-btn-wide {
    text-align: left;
    padding: 11px 12px;
    font-size: 13px;
  }

  /* ── Category grid ── */
  .ri-cat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 5px;
    margin-bottom: 6px;
  }

  /* ── Product / option list ── */
  .ri-prod-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 6px;
    overflow-y: auto;
  }

  /* ── Empty hint ── */
  .ri-empty {
    color: var(--r-text-dim);
    font-size: 12px;
    text-align: center;
    padding: 20px 12px;
    border: 1px dashed var(--r-border-soft);
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .ri-na {
    color: var(--r-text-muted);
    font-style: italic;
    font-size: 14px;
    text-align: center;
    padding: 40px 16px;
  }

  /* ── Colour swatch grid ── */
  .ri-swatch-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    flex: 1;
    align-content: start;
  }
  .ri-swatch {
    border-radius: 8px;
    padding: 12px 4px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.15;
    cursor: pointer;
    border: 2px solid transparent;
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.08s;
  }
  .ri-swatch.has-border:not(.is-selected) {
    border-color: var(--r-border-soft);
  }
  .ri-swatch:hover { transform: scale(1.03); }
  .ri-swatch:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
  }
  .ri-swatch.is-selected {
    border-color: var(--r-selected-bd);
    box-shadow: 0 0 0 2px var(--r-pane), 0 0 0 4px var(--r-selected-bd);
  }

  /* ── 2-col grid ── */
  .ri-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-bottom: 6px;
  }

  /* ── Text input / textarea ── */
  .ri-input {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 12px;
    min-height: 44px;
    font-size: 14px;
    font-family: 'Barlow', sans-serif;
    background: var(--r-page);
    color: var(--r-text);
    border: 1px solid var(--r-border);
    border-radius: 8px;
    appearance: none;
    -webkit-appearance: none;
  }
  textarea.ri-input { min-height: 80px; resize: vertical; }
  .ri-input:focus {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
    border-color: var(--r-focus);
  }

  /* ── Photo capture ── */
  .ri-photo-block { margin-bottom: 6px; }
  .ri-photo-add-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .ri-photo-add-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: var(--r-page);
    border: 1px dashed var(--r-border);
    color: var(--r-text);
    border-radius: 8px;
    padding: 18px 8px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    min-height: 72px;
  }
  .ri-photo-add-btn:hover { background: var(--r-pane); }
  .ri-photo-icon { font-size: 24px; }
  .ri-photo-uploading {
    text-align: center;
    padding: 24px 8px;
    color: var(--r-text-dim);
    font-size: 13px;
  }
  .ri-photo-preview-wrap {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--r-border);
  }
  .ri-photo-preview { display: block; width: 100%; max-height: 160px; object-fit: cover; }
  .ri-photo-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0,0,0,0.6);
    color: #fff;
    border: 0;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }

  /* ── Submit ── */
  .ri-submit {
    width: 100%;
    padding: 14px;
    min-height: 52px;
    background: var(--r-yellow);
    color: var(--r-page);
    border: 0;
    border-radius: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 16px;
    cursor: pointer;
    margin-top: auto;
    transition: background 0.15s, opacity 0.15s;
  }
  .ri-submit:hover:not(:disabled) { background: var(--r-yellow-hover); }
  .ri-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .ri-error {
    color: var(--r-danger-fg);
    background: var(--r-danger-bg);
    border: 1px solid var(--r-danger-bd);
    padding: 10px;
    border-radius: 8px;
    margin-top: 10px;
    font-size: 13px;
  }

  /* ── Thanks screen ── */
  .ri-thanks {
    max-width: 520px;
    margin: 80px auto;
    background: var(--r-pane);
    border-radius: 12px;
    padding: 40px 24px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .ri-check { font-size: 48px; color: #2D8C7A; margin-bottom: 16px; }
  .ri-ref {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    color: var(--r-yellow);
    margin: 8px 0;
    letter-spacing: 0.04em;
  }
  .ri-sub { color: var(--r-text-muted); font-size: 15px; line-height: 1.5; margin-top: 12px; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .ri-panes { grid-template-columns: 1fr; }
    .ri-frame { height: auto; }
    .ri-pane { overflow-y: visible; }
    .ri-header { flex-wrap: wrap; }
    .ri-meta { width: 100%; margin-left: 0; justify-content: flex-start; }
  }

  /* ── Accessible-theme type & sizing bumps (Light + Max only) ── */
  .ri-wrap.theme-light,
  .ri-wrap.theme-max {
    font-size: 15px;
  }
  .ri-wrap.theme-light .ri-btn,
  .ri-wrap.theme-max .ri-btn {
    font-size: 13px;
    min-height: 46px;
    border-width: 2px;
  }
  .ri-wrap.theme-light .ri-btn-wide,
  .ri-wrap.theme-max .ri-btn-wide {
    font-size: 14px;
  }
  .ri-wrap.theme-light h1,
  .ri-wrap.theme-max h1 {
    font-size: 24px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-step-label,
  .ri-wrap.theme-max .ri-step-label {
    font-size: 12px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-eyebrow,
  .ri-wrap.theme-max .ri-eyebrow {
    font-size: 11px;
    color: var(--r-text-muted);
  }
  .ri-wrap.theme-light .ri-meta-label,
  .ri-wrap.theme-max .ri-meta-label {
    font-size: 10px;
    color: var(--r-text-muted);
  }
  .ri-wrap.theme-light .ri-meta-val,
  .ri-wrap.theme-max .ri-meta-val {
    font-size: 17px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-input,
  .ri-wrap.theme-max .ri-input {
    font-size: 15px;
    min-height: 46px;
    border-width: 2px;
  }
  .ri-wrap.theme-light .ri-submit,
  .ri-wrap.theme-max .ri-submit {
    background: var(--r-selected-bg);
    color: var(--r-selected-fg);
  }
  .ri-wrap.theme-light .ri-ref,
  .ri-wrap.theme-max .ri-ref {
    color: var(--r-text);
  }

  /* ── Theme toggle ── */
  .ri-theme-toggle {
    display: flex;
    gap: 4px;
    margin-left: 14px;
    background: var(--r-pane-sunken);
    border-radius: 8px;
    padding: 3px;
  }
  .ri-theme-btn {
    background: transparent;
    color: var(--r-text);
    border: 0;
    border-radius: 6px;
    padding: 8px 14px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    min-height: 36px;
    transition: background 0.12s;
  }
  .ri-theme-btn:hover { background: var(--r-pane); }
  .ri-theme-btn:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 2px;
  }
  .ri-theme-btn.is-active {
    background: var(--r-selected-bg);
    color: var(--r-selected-fg);
    font-weight: 900;
  }
  .ri-wrap.theme-light .ri-theme-btn,
  .ri-wrap.theme-max .ri-theme-btn {
    font-size: 14px;
    min-height: 44px;
  }
`;
