'use client';
import { useState, FormEvent } from 'react';
import { CATEGORIES, PRODUCT_DATA, SUPERVISORS } from '@/lib/returnProductData';

interface Props {
  formId: string;
}

function generateRef(): string {
  const now = new Date();
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RET-${yymmdd}-${rand}`;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReturnIntakeForm({ formId }: Props) {
  const [reportRef]  = useState<string>(() => generateRef());
  const [category,   setCategory]   = useState('');
  const [product,    setProduct]    = useState('');
  const [colour,     setColour]     = useState('');
  const [size,       setSize]       = useState('');
  const [qty,        setQty]        = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [notes,      setNotes]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const date = todayLocal();

  const categoryEntry = CATEGORIES.find((c) => c.label === category);
  const productList   = categoryEntry?.products ?? [];
  const productInfo   = product ? PRODUCT_DATA[product] : null;
  const colourList    = productInfo?.colours ?? [];
  const sizeList      = productInfo?.sizes   ?? [];

  function handleCategoryChange(val: string) {
    setCategory(val);
    setProduct('');
    setColour('');
    setSize('');
  }

  function handleProductChange(val: string) {
    setProduct(val);
    setColour('');
    setSize('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const data = {
      report_ref:  reportRef,
      date,
      category,
      product,
      colour,
      size,
      qty,
      supervisor,
      notes,
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({
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

      // Fire Telegram notification — non-blocking, errors are silent to the user
      fetch('/api/returns-notify', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(data),
      }).catch(() => { /* silent */ });

      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="ri-wrap">
        <div className="ri-card ri-thanks">
          <div className="ri-check">✓</div>
          <h1>Return Logged</h1>
          <p className="ri-ref">{reportRef}</p>
          <p className="ri-sub">Your return has been recorded. The supervisor has been notified.</p>
        </div>
        <style jsx>{css}</style>
      </main>
    );
  }

  return (
    <main className="ri-wrap">
      <form onSubmit={onSubmit} className="ri-card">
        {/* Header */}
        <div className="ri-header">
          <div className="ri-logo-wrap">
            <img src="/logo.jpg" alt="Olympic Paints" width={40} height={40} />
          </div>
          <div>
            <div className="ri-eyebrow">Olympic Paints</div>
            <h1>Returns Intake</h1>
          </div>
        </div>

        {/* Report ref + date row */}
        <div className="ri-meta-row">
          <div className="ri-meta-item">
            <span className="ri-label">Report No.</span>
            <span className="ri-meta-val">{reportRef}</span>
          </div>
          <div className="ri-meta-item">
            <span className="ri-label">Date</span>
            <span className="ri-meta-val">{date}</span>
          </div>
        </div>

        <div className="ri-divider" />

        {/* Step 1 — Category */}
        <div className="ri-step-label">Step 1 — Product Category</div>
        <label className="ri-field">
          <span className="ri-label">Category *</span>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            required
          >
            <option value="">— select category —</option>
            {CATEGORIES.map((c) => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </label>

        {/* Step 2 — Product */}
        {category && (
          <label className="ri-field ri-fade-in">
            <span className="ri-label">Product *</span>
            <select
              value={product}
              onChange={(e) => handleProductChange(e.target.value)}
              required
            >
              <option value="">— select product —</option>
              {productList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        )}

        {/* Step 3 — Colour */}
        {product && (
          <label className="ri-field ri-fade-in">
            <span className="ri-label">Colour *</span>
            <select
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              required
            >
              <option value="">— select colour —</option>
              {colourList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="ri-hint">{colourList.length} colour{colourList.length !== 1 ? 's' : ''} available for this product</span>
          </label>
        )}

        {/* Size */}
        {product && (
          <label className="ri-field ri-fade-in">
            <span className="ri-label">Size *</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              required
            >
              <option value="">— select size —</option>
              {sizeList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        {/* Quantity */}
        {product && (
          <label className="ri-field ri-fade-in">
            <span className="ri-label">Quantity *</span>
            <input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Number of units"
              required
            />
          </label>
        )}

        <div className="ri-divider" />

        {/* Supervisor */}
        <label className="ri-field">
          <span className="ri-label">Supervisor Responsible *</span>
          <select
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            required
          >
            <option value="">— select supervisor —</option>
            {SUPERVISORS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Notes */}
        <label className="ri-field">
          <span className="ri-label">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — reason for return, damage description, batch info…"
            rows={3}
          />
        </label>

        {error && <p className="ri-error">{error}</p>}

        <button type="submit" disabled={busy} className="ri-submit">
          {busy ? 'Submitting…' : 'Log Return'}
        </button>
      </form>
      <style jsx>{css}</style>
    </main>
  );
}

const css = `
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ri-fade-in { animation: fadeSlide 0.18s ease-out; }

  .ri-wrap {
    background: #0D2040;
    min-height: 100vh;
    padding: 24px 16px 64px;
    font-family: 'Barlow', sans-serif;
    color: #fff;
  }
  .ri-card {
    max-width: 520px;
    margin: 0 auto;
    background: #1A3D6E;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .ri-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  .ri-logo-wrap {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }
  .ri-logo-wrap img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ri-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6B9ED0;
    margin-bottom: 2px;
  }
  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 26px;
    text-transform: uppercase;
    color: #F5C400;
    margin: 0;
    line-height: 1;
  }
  .ri-meta-row {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  .ri-meta-item {
    flex: 1;
    background: rgba(13,32,64,0.6);
    border: 1px solid rgba(107,158,208,0.25);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .ri-meta-val {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    color: #F5C400;
    margin-top: 4px;
  }
  .ri-divider {
    height: 1px;
    background: rgba(107,158,208,0.2);
    margin: 16px 0;
  }
  .ri-step-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6B9ED0;
    margin-bottom: 8px;
    margin-top: 4px;
  }
  .ri-field {
    display: block;
    margin: 14px 0;
  }
  .ri-label {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #F5C400;
    margin-bottom: 6px;
  }
  .ri-hint {
    display: block;
    font-size: 11px;
    color: #6B9ED0;
    margin-top: 4px;
  }
  select, input[type=number], textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    min-height: 48px;
    font-size: 16px;
    font-family: 'Barlow', sans-serif;
    background: #0D2040;
    color: #fff;
    border: 1px solid rgba(107,158,208,0.35);
    border-radius: 8px;
    appearance: none;
    -webkit-appearance: none;
  }
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B9ED0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
  }
  select:focus, input:focus, textarea:focus {
    outline: 2px solid #F5C400;
    outline-offset: 2px;
    border-color: #F5C400;
  }
  textarea { min-height: 80px; resize: vertical; }

  .ri-submit {
    width: 100%;
    padding: 16px;
    min-height: 52px;
    background: #F5C400;
    color: #0D2040;
    border: 0;
    border-radius: 8px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 17px;
    cursor: pointer;
    margin-top: 24px;
    transition: background 0.15s;
  }
  .ri-submit:hover:not(:disabled) { background: #FAE04D; }
  .ri-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .ri-error {
    color: #FDDCDC;
    background: rgba(232,96,96,0.14);
    border: 1px solid rgba(232,96,96,0.35);
    padding: 12px;
    border-radius: 8px;
    margin-top: 12px;
    font-size: 14px;
  }

  /* Thanks screen */
  .ri-thanks {
    text-align: center;
    padding: 40px 24px;
  }
  .ri-check {
    font-size: 48px;
    color: #2D8C7A;
    margin-bottom: 16px;
  }
  .ri-ref {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    color: #F5C400;
    margin: 8px 0;
    letter-spacing: 0.04em;
  }
  .ri-sub {
    color: #B8CCE8;
    font-size: 15px;
    line-height: 1.5;
    margin-top: 12px;
  }

  @media (max-width: 480px) {
    .ri-card { padding: 16px; }
    h1 { font-size: 22px; }
    .ri-meta-row { flex-direction: column; gap: 8px; }
  }
`;
