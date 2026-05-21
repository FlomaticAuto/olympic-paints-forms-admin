'use client';
import { useState, useEffect, FormEvent } from 'react';
import { CATEGORIES, PRODUCT_DATA, SUPERVISORS } from '@/lib/returnProductData';
import { COLOUR_HEX, getColourHex } from '@/lib/returnColourHex';
import { pickContrastColour, needsSwatchBorder, requiredFieldsFilled } from '@/lib/uiHelpers';

interface Props { formId: string; }

type Theme = 'theme-dark' | 'theme-light' | 'theme-max';
const THEME_STORAGE_KEY = 'returns-intake-theme';

function generateRef(): string {
  const now = new Date();
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RET-${yymmdd}-${rand}`;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReturnIntakeForm({ formId }: Props) {
  const [reportRef]  = useState<string>(() => generateRef());
  const [theme, setTheme] = useState<Theme>('theme-dark');

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'theme-light' || saved === 'theme-max' || saved === 'theme-dark') {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const [category,   setCategory]   = useState('');
  const [product,    setProduct]    = useState('');
  const [colour,     setColour]     = useState('');
  const [size,       setSize]       = useState('');
  const [qty,        setQty]        = useState<number | ''>('');
  const [supervisor, setSupervisor] = useState('');
  const [returnType, setReturnType] = useState('');
  const [batchNo,    setBatchNo]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [notesOpen,  setNotesOpen]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const date = todayLocal();

  const categoryEntry = CATEGORIES.find(c => c.label === category);
  const productList   = categoryEntry?.products ?? [];
  const productInfo   = product ? PRODUCT_DATA[product] : null;
  const colourList    = productInfo?.colours ?? [];
  const sizeList      = productInfo?.sizes   ?? [];
  const colourIsNA    = colourList.length === 1 && colourList[0] === 'N/A';

  function handleCategoryChange(val: string) {
    setCategory(val);
    setProduct('');
    setColour('');
    setSize('');
  }

  function handleProductChange(val: string) {
    setProduct(val);
    setSize('');
    const info = val ? PRODUCT_DATA[val] : null;
    const colours = info?.colours ?? [];
    setColour(colours.length === 1 && colours[0] === 'N/A' ? 'N/A' : '');
  }

  function incQty() { setQty(typeof qty === 'number' ? qty + 1 : 1); }
  function decQty() {
    if (typeof qty === 'number' && qty > 1) setQty(qty - 1);
    else if (typeof qty === 'number' && qty === 1) setQty('');
  }

  const canSubmit = requiredFieldsFilled({
    category, product, colour, size, qty, returnType, batchNo, supervisor,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const data = {
      report_ref: reportRef,
      date,
      category,
      product,
      colour,
      size,
      qty: String(qty),
      return_type: returnType,
      batch_no: batchNo,
      supervisor,
      notes,
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data,
          metadata: { form_type: 'returns_intake', report_ref: reportRef },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? 'Submission failed. Please try again.');
        setBusy(false);
        return;
      }
      fetch('/api/returns-notify', {
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
          <h1>Return Logged</h1>
          <p className="ri-ref">{reportRef}</p>
          <p className="ri-sub">Your return has been recorded. The supervisor has been notified.</p>
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
            <h1>Returns Intake</h1>
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
        </header>

        <div className="ri-panes">

          {/* LEFT PANE — Category + Product */}
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

          {/* MIDDLE PANE — Colour */}
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

          {/* RIGHT PANE — everything else */}
          <section className="ri-pane">
            <div className="ri-step-label">4 · Size</div>
            {!product && <EmptyHint text="Pick a product to see sizes" />}
            {product && <SizePills sizes={sizeList} value={size} onChange={setSize} />}

            <div className="ri-step-label">5 · Quantity</div>
            <QtyStepper value={qty} onInc={incQty} onDec={decQty} />

            <div className="ri-step-label">6 · Return Type</div>
            <ReturnTypeGrid value={returnType} onChange={setReturnType} />

            <div className="ri-step-label">7 · Supervisor</div>
            <SupervisorGrid value={supervisor} onChange={setSupervisor} />

            <div className="ri-step-label">8 · Batch Number</div>
            <input
              type="text"
              className="ri-input"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              placeholder="e.g. BT-2026-0042"
              required
            />

            {!notesOpen && (
              <button type="button" className="ri-notes-toggle" onClick={() => setNotesOpen(true)}>
                + Add Notes (optional)
              </button>
            )}
            {notesOpen && (
              <div className="ri-notes-block">
                <div className="ri-step-label ri-notes-label">
                  9 · Notes
                  <button type="button" className="ri-notes-close" onClick={() => setNotesOpen(false)} aria-label="Close notes">×</button>
                </div>
                <textarea
                  className="ri-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Reason for return, damage description, batch info…"
                  rows={3}
                />
              </div>
            )}

            {error && <p className="ri-error">{error}</p>}

            <button type="submit" disabled={!canSubmit || busy} className="ri-submit">
              {busy ? 'Submitting…' : '✓ Log Return'}
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

function SizePills({ sizes, value, onChange }: { sizes: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-pill-row">
      {sizes.map(s => (
        <button
          key={s}
          type="button"
          className={`ri-btn ri-btn-pill ${value === s ? 'is-active' : ''}`}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function QtyStepper({ value, onInc, onDec }: { value: number | ''; onInc: () => void; onDec: () => void }) {
  return (
    <div className="ri-stepper">
      <button type="button" className="ri-btn ri-step-btn" onClick={onDec} aria-label="Decrease quantity">−</button>
      <div className={`ri-step-value ${value === '' ? 'is-empty' : ''}`}>{value === '' ? '0' : value}</div>
      <button type="button" className="ri-btn ri-step-btn" onClick={onInc} aria-label="Increase quantity">+</button>
    </div>
  );
}

function ReturnTypeGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = ['Rework', 'Inventory', 'Inv+Rework', 'Written Off'];
  return (
    <div className="ri-grid-2">
      {opts.map(o => (
        <button
          key={o}
          type="button"
          className={`ri-btn ${value === o ? 'is-active' : ''}`}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {o === 'Inv+Rework' ? 'Inv + Rework' : o}
        </button>
      ))}
    </div>
  );
}

function SupervisorGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-grid-3">
      {SUPERVISORS.map((s, i) => (
        <button
          key={s}
          type="button"
          className={`ri-btn ${value === s ? 'is-active' : ''} ${i === SUPERVISORS.length - 1 && SUPERVISORS.length % 3 === 2 ? 'is-span-2' : ''}`}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
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
    grid-template-columns: 1fr 1.3fr 0.9fr;
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
  .ri-step-sub {
    color: var(--r-text-dim);
    font-weight: 700;
    font-size: 10px;
  }

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
  .ri-btn-pill { flex: 1; }

  /* ── Category grid ── */
  .ri-cat-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
    margin-bottom: 6px;
  }

  /* ── Product list ── */
  .ri-prod-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
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
    grid-template-columns: repeat(5, 1fr);
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

  /* ── Pill row ── */
  .ri-pill-row { display: flex; gap: 5px; }

  /* ── Stepper ── */
  .ri-stepper { display: flex; gap: 5px; align-items: stretch; }
  .ri-step-btn { flex: 0 0 56px; font-size: 22px; font-weight: 900; padding: 8px; line-height: 1; }
  .ri-step-value {
    flex: 1;
    background: var(--r-page);
    border: 1px solid var(--r-border);
    border-radius: 8px;
    text-align: center;
    padding: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    color: var(--r-yellow);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
  }
  .ri-step-value.is-empty { color: rgba(255,255,255,0.25); }

  /* ── 2x2 / 3-col grids ── */
  .ri-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }
  .ri-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }
  .ri-grid-3 .is-span-2 { grid-column: span 2; }

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

  /* ── Notes toggle ── */
  .ri-notes-toggle {
    background: transparent;
    border: 1px dashed var(--r-border);
    color: var(--r-text-dim);
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    margin-top: 12px;
  }
  .ri-notes-toggle:hover { background: var(--r-pane); }
  .ri-notes-block { margin-top: 12px; }
  .ri-notes-label { justify-content: space-between; }
  .ri-notes-close {
    background: transparent; border: 0; color: var(--r-text-dim);
    font-size: 18px; line-height: 1; cursor: pointer;
    padding: 0 6px;
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
  /* Phone / narrow — stack panes vertically. */
  @media (max-width: 900px) {
    .ri-panes { grid-template-columns: 1fr; }
    .ri-frame { height: auto; }
    .ri-pane { overflow-y: visible; }
    .ri-header { flex-wrap: wrap; }
    .ri-meta { width: 100%; margin-left: 0; justify-content: flex-start; }
  }
`;
