'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResinEstimate, ResinEstimateLine, PriceBasis } from '@/lib/resinEstimates/types';

interface Product {
  id: string;
  code: string | null;
  name: string;
  local_price: number | null;
  long_price: number | null;
  category: string;
  sort: number;
}

interface LineDraft {
  key: string;
  product_id: string | null;
  product_code: string | null;
  description: string;
  category: string | null;
  unit: string;
  qty: string;
  unit_price: string;
}

const money = (n: number) =>
  'R ' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let keySeq = 0;
const newKey = () => `l${Date.now()}_${keySeq++}`;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '14px', fontFamily: 'var(--font-body)',
  border: '1px solid var(--color-border-default)', borderRadius: 'var(--r-md)',
  background: 'var(--color-surface-base)', color: 'var(--color-text-primary)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginBottom: '4px',
};

export default function EstimateForm({
  action, estimate, existingLines,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (fd: FormData) => any;
  estimate?: ResinEstimate;
  existingLines?: ResinEstimateLine[];
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [priceBasis, setPriceBasis] = useState<PriceBasis>(estimate?.price_basis ?? 'local');
  const [lines, setLines] = useState<LineDraft[]>(
    existingLines && existingLines.length
      ? existingLines.map(l => ({
          key: newKey(),
          product_id: l.product_id,
          product_code: l.product_code,
          description: l.description,
          category: l.category,
          unit: l.unit ?? 'kg',
          qty: String(l.qty ?? ''),
          unit_price: String(l.unit_price ?? ''),
        }))
      : [{ key: newKey(), product_id: null, product_code: null, description: '', category: null, unit: 'kg', qty: '', unit_price: '' }],
  );

  useEffect(() => {
    fetch('/api/resin-leads/products')
      .then(r => r.json())
      .then((d: Product[]) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));
  }, []);

  const priceOf = (p: Product): number | null =>
    priceBasis === 'long' ? (p.long_price ?? p.local_price) : (p.local_price ?? p.long_price);

  function pickProduct(key: string, productId: string) {
    const p = products.find(x => x.id === productId);
    setLines(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      product_id: p ? p.id : null,
      product_code: p?.code ?? null,
      description: p ? p.name : l.description,
      category: p?.category ?? null,
      unit: 'kg',
      // only auto-fill price if the user hasn't typed one yet
      unit_price: l.unit_price || (p && priceOf(p) != null ? String(priceOf(p)) : l.unit_price),
    }));
  }

  const setField = (key: string, field: keyof LineDraft, value: string) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, [field]: value } : l));

  const addLine = () =>
    setLines(prev => [...prev, { key: newKey(), product_id: null, product_code: null, description: '', category: null, unit: 'kg', qty: '', unit_price: '' }]);
  const removeLine = (key: string) =>
    setLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== key) : prev));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0), 0),
    [lines],
  );
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const linesJson = JSON.stringify(
    lines
      .filter(l => l.description.trim() || l.product_id)
      .map(l => ({
        product_id: l.product_id, product_code: l.product_code, description: l.description,
        category: l.category, unit: l.unit, qty: l.qty, unit_price: l.unit_price,
      })),
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <form action={action} style={{ display: 'grid', gap: '20px', maxWidth: '960px' }}>
      <input type="hidden" name="lines" value={linesJson} />
      <input type="hidden" name="price_basis" value={priceBasis} />

      {/* Customer details */}
      <section style={cardStyle}>
        <h3 style={cardHeadStyle}>Customer</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Client / Company *</label>
            <input name="client" required defaultValue={estimate?.client ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Contact name</label>
            <input name="contact_name" defaultValue={estimate?.contact_name ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Contact email</label>
            <input name="contact_email" type="email" defaultValue={estimate?.contact_email ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Contact phone</label>
            <input name="contact_phone" defaultValue={estimate?.contact_phone ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Site / location</label>
            <input name="site" defaultValue={estimate?.site ?? ''} style={inputStyle} />
          </div>
        </div>
      </section>

      {/* Estimate meta */}
      <section style={cardStyle}>
        <h3 style={cardHeadStyle}>Estimate details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Date issued</label>
            <input name="date_issued" type="date" defaultValue={estimate?.date_issued ?? today} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valid until</label>
            <input name="valid_until" type="date" defaultValue={estimate?.valid_until ?? ''} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Price basis</label>
            <select value={priceBasis} onChange={e => setPriceBasis(e.target.value as PriceBasis)} style={inputStyle}>
              <option value="local">Local (list)</option>
              <option value="long">Long distance</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Prepared by</label>
            <input name="prepared_by" defaultValue={estimate?.prepared_by ?? 'Kim Williams'} style={inputStyle} />
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: '10px' }}>
          Changing the price basis auto-fills the unit price on newly selected products. It does not overwrite prices you have already typed.
        </p>
      </section>

      {/* Line items */}
      <section style={cardStyle}>
        <h3 style={cardHeadStyle}>Products</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={{ ...thStyle, width: '70px' }}>Unit</th>
                <th style={{ ...thStyle, textAlign: 'right', width: '90px' }}>Qty</th>
                <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Unit price (R)</th>
                <th style={{ ...thStyle, textAlign: 'right', width: '120px' }}>Line total</th>
                <th style={{ ...thStyle, width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const lineTotal = (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0);
                return (
                  <tr key={l.key}>
                    <td style={tdStyle}>
                      <select
                        value={l.product_id ?? ''}
                        onChange={e => pickProduct(l.key, e.target.value)}
                        style={{ ...inputStyle, marginBottom: '4px' }}
                      >
                        <option value="">— select product —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.category ? ` (${p.category})` : ''}{priceOf(p) != null ? ` · ${money(priceOf(p)!)}` : ' · no list price'}
                          </option>
                        ))}
                      </select>
                      <input
                        value={l.description}
                        onChange={e => setField(l.key, 'description', e.target.value)}
                        placeholder="Description (editable)"
                        style={{ ...inputStyle, fontSize: '12px' }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input value={l.unit} onChange={e => setField(l.key, 'unit', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                    </td>
                    <td style={tdStyle}>
                      <input value={l.qty} onChange={e => setField(l.key, 'qty', e.target.value)} inputMode="decimal" style={{ ...inputStyle, textAlign: 'right' }} />
                    </td>
                    <td style={tdStyle}>
                      <input value={l.unit_price} onChange={e => setField(l.key, 'unit_price', e.target.value)} inputMode="decimal" style={{ ...inputStyle, textAlign: 'right' }} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{money(lineTotal)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button type="button" onClick={() => removeLine(l.key)} title="Remove line"
                        style={{ background: 'none', border: 'none', color: 'var(--color-danger-fg)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addLine} style={secondaryBtn}>+ Add product line</button>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <div style={{ minWidth: '260px' }}>
            <Row label="Subtotal (excl. VAT)" value={money(subtotal)} />
            <Row label="VAT @ 15%" value={money(vat)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--color-brand-primary)', color: '#0D0D0B', borderRadius: 'var(--r-md)', marginTop: '6px', fontWeight: 800 }}>
              <span>Total (incl. VAT)</span><span>{money(total)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Notes & terms */}
      <section style={cardStyle}>
        <h3 style={cardHeadStyle}>Notes &amp; terms (optional)</h3>
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Notes (shown on the quote)</label>
            <textarea name="notes" defaultValue={estimate?.notes ?? ''} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Terms (one per line — leave blank for defaults)</label>
            <textarea name="terms" defaultValue={estimate?.terms ?? ''} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="submit" style={primaryBtn}>{estimate ? 'Save changes' : 'Create estimate'}</button>
        <a href={estimate ? `/admin/resin-estimates/${estimate.id}` : '/admin/resin-estimates'} style={{ ...secondaryBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Cancel</a>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', fontSize: '13px', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface-base)', border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--r-xl)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)',
};
const cardHeadStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', textTransform: 'uppercase',
  margin: '0 0 14px', color: 'var(--color-text-primary)',
};
const thStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'left',
  color: 'var(--color-text-secondary)', padding: '6px 8px', borderBottom: '2px solid var(--color-border-default)',
};
const tdStyle: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
const primaryBtn: React.CSSProperties = {
  background: 'var(--color-brand-primary)', color: '#0D0D0B', border: 'none', borderRadius: 'var(--r-pill)',
  padding: '10px 22px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-body)',
};
const secondaryBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--r-pill)', padding: '8px 18px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
  marginTop: '12px', fontFamily: 'var(--font-body)',
};
