'use client';

import { useEffect, useMemo, useState } from 'react';

// Estimate builder + recent list for the /resin-leads dashboard.
// Public (no auth) — matches the access model of the rest of the page.
// Styled with the shared rl-* classes so it sits alongside Capture Lead / Log Visit.

interface Product {
  id: string;
  code: string | null;
  name: string;
  local_price: number | null;
  long_price: number | null;
  category: string | null;
}
interface LineDraft {
  key: string;
  product_id: string;
  product_code: string | null;
  description: string;
  category: string | null;
  unit: string;
  qty: string;
  unit_price: string;
}
interface EstimateRow {
  id: string;
  estimate_number: string;
  client: string;
  contact_name: string | null;
  date_issued: string;
  status: string;
  price_basis: string;
  total?: number;
}

const fmtR = (n: number) => 'R' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_PILL: Record<string, string> = {
  draft: 'rl-pill rl-pill-neutral', sent: 'rl-pill rl-pill-info',
  approved: 'rl-pill rl-pill-success', declined: 'rl-pill rl-pill-danger',
};
const statusPill = (s: string) => STATUS_PILL[s] ?? 'rl-pill rl-pill-neutral';
const normalizeDecimal = (raw: string) => raw.replace(',', '.');
let keySeq = 0;
const newKey = () => `l${keySeq++}`;
const emptyLine = (): LineDraft => ({ key: newKey(), product_id: '', product_code: null, description: '', category: null, unit: 'kg', qty: '', unit_price: '' });

export default function ResinEstimateView({ rep }: { rep: string }) {
  const [catalogue, setCatalogue] = useState<Product[]>([]);
  const [priceBasis, setPriceBasis] = useState<'local' | 'long'>('local');

  const [client, setClient] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [site, setSite] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<EstimateRow[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/resin-leads/products').then(r => r.json())
      .then((d: Product[]) => setCatalogue(Array.isArray(d) ? d : [])).catch(() => {});
    loadRecent();
  }, []);

  function loadRecent() {
    fetch('/api/resin-leads/estimate').then(r => r.json())
      .then((d: EstimateRow[]) => setRecent(Array.isArray(d) ? d : [])).catch(() => {});
  }

  const priceOf = (p: Product): number | null =>
    priceBasis === 'long' ? (p.long_price ?? p.local_price) : (p.local_price ?? p.long_price);

  function selectProduct(key: string, id: string) {
    const p = catalogue.find(x => x.id === id);
    setLines(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      product_id: id,
      product_code: p?.code ?? null,
      description: p ? p.name : l.description,
      category: p?.category ?? null,
      unit_price: l.unit_price || (p && priceOf(p) != null ? String(priceOf(p)) : l.unit_price),
    }));
  }
  const setField = (key: string, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map(l => l.key === key ? { ...l, ...patch } : l));
  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (key: string) => setLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== key) : prev));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0), 0),
    [lines],
  );
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  function resetForm() {
    setClient(''); setContactName(''); setContactEmail(''); setContactPhone('');
    setSite(''); setValidUntil(''); setNotes(''); setLines([emptyLine()]);
  }

  // Create the estimate, then immediately render+email its PDF to Kim.
  async function createAndSend() {
    setMsg(null);
    if (!client.trim()) { setMsg({ ok: false, text: 'Enter a client / company name.' }); return; }
    const payloadLines = lines
      .filter(l => l.product_id || l.description.trim())
      .map(l => ({
        product_id: l.product_id || null, product_code: l.product_code, description: l.description,
        category: l.category, unit: l.unit, qty: l.qty, unit_price: l.unit_price,
      }));
    if (payloadLines.length === 0) { setMsg({ ok: false, text: 'Add at least one product line.' }); return; }

    setBusy(true);
    try {
      const res = await fetch('/api/resin-leads/estimate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client, contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone,
          site, valid_until: validUntil || null, price_basis: priceBasis, notes,
          prepared_by: rep, lines: payloadLines,
        }),
      });
      const est = await res.json();
      if (!res.ok) throw new Error(est.error ?? 'Save failed');

      setMsg({ ok: true, text: `Saved ${est.estimate_number}. Emailing PDF to Kim…` });
      const sendRes = await fetch(`/api/resin-leads/estimate/${est.id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error ?? 'Email failed');

      setMsg({ ok: true, text: `${est.estimate_number} emailed to ${(sendData.sentTo ?? []).join(', ')}.` });
      resetForm();
      loadRecent();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    setSendingId(id);
    try {
      const res = await fetch(`/api/resin-leads/estimate/${id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Email failed');
      setMsg({ ok: true, text: `Re-sent to ${(d.sentTo ?? []).join(', ')}.` });
      loadRecent();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Re-send failed.' });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="rl-form">
      <div className="rl-section-title">Customer</div>
      <div className="rl-field">
        <label className="rl-label">Client / Company <span className="rl-req">*</span></label>
        <input className="rl-input" value={client} onChange={e => setClient(e.target.value)} placeholder="Company name" autoComplete="off" />
      </div>
      <div className="rl-row-2">
        <div className="rl-field">
          <label className="rl-label">Contact Name</label>
          <input className="rl-input" value={contactName} onChange={e => setContactName(e.target.value)} autoComplete="off" />
        </div>
        <div className="rl-field">
          <label className="rl-label">Contact Email</label>
          <input className="rl-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="rl-row-2">
        <div className="rl-field">
          <label className="rl-label">Contact Phone</label>
          <input className="rl-input" value={contactPhone} onChange={e => setContactPhone(e.target.value)} autoComplete="off" />
        </div>
        <div className="rl-field">
          <label className="rl-label">Site / Location</label>
          <input className="rl-input" value={site} onChange={e => setSite(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="rl-row-2">
        <div className="rl-field">
          <label className="rl-label">Valid Until</label>
          <input className="rl-input" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
        <div className="rl-field">
          <label className="rl-label">Price Basis</label>
          <select className="rl-input" value={priceBasis} onChange={e => setPriceBasis(e.target.value as 'local' | 'long')}>
            <option value="local">Local (list)</option>
            <option value="long">Long distance</option>
          </select>
        </div>
      </div>

      <div className="rl-section-title">
        Products
        <span className="rl-section-note">Prices auto-fill {priceBasis === 'long' ? 'long distance' : 'local'} · editable</span>
      </div>
      <div className="rl-items">
        {lines.map(l => {
          const p = catalogue.find(x => x.id === l.product_id);
          const listRef = p ? priceOf(p) : null;
          const lineTotal = (parseFloat(l.qty) || 0) * (parseFloat(l.unit_price) || 0);
          return (
            <div key={l.key} className="rl-item-card">
              <div className="rl-item-card-head">
                <select className="rl-input rl-item-product" value={l.product_id} onChange={e => selectProduct(l.key, e.target.value)}>
                  <option value="">— Select product —</option>
                  {catalogue.map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.code ? `${pr.code} · ` : ''}{pr.name}{pr.category ? ` (${pr.category})` : ''}</option>
                  ))}
                </select>
                <button type="button" className="rl-item-del" onClick={() => removeLine(l.key)} aria-label="Remove product" disabled={lines.length === 1}>×</button>
              </div>
              <div className="rl-item-grid">
                <div className="rl-field">
                  <label className="rl-label">Unit Price (R)</label>
                  <input className="rl-input" type="text" inputMode="decimal" placeholder="Type price"
                    value={l.unit_price} onChange={e => setField(l.key, { unit_price: normalizeDecimal(e.target.value) })} />
                  {listRef != null && <p className="rl-ref">List ref: {fmtR(listRef)}</p>}
                </div>
                <div className="rl-field">
                  <label className="rl-label">Qty ({l.unit})</label>
                  <input className="rl-input" type="text" inputMode="decimal" placeholder="0"
                    value={l.qty} onChange={e => setField(l.key, { qty: normalizeDecimal(e.target.value) })} />
                </div>
                <div className="rl-field">
                  <label className="rl-label">Line Total</label>
                  <div className="rl-item-value-v">{fmtR(lineTotal)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rl-items-foot">
        <div className="rl-items-foot-btns">
          <button type="button" className="rl-add-btn" onClick={addLine}>+ Add product line</button>
        </div>
        <div className="rl-grand">
          <span className="rl-grand-l">Total (incl. VAT)</span>
          <span className="rl-grand-v">{fmtR(total)}</span>
        </div>
      </div>
      <p className="rl-ref" style={{ textAlign: 'right', marginTop: '-4px' }}>
        Subtotal {fmtR(subtotal)} · VAT @ 15% {fmtR(vat)}
      </p>

      <div className="rl-field">
        <label className="rl-label">Notes (optional, shown on the quote)</label>
        <textarea className="rl-input rl-item-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {msg && (
        msg.ok
          ? <div className="rl-est-ok" role="status">{msg.text}</div>
          : <p className="rl-error">{msg.text}</p>
      )}

      <button type="button" className="rl-submit" onClick={createAndSend} disabled={busy}>
        {busy ? 'Working…' : 'Create & Email PDF to Kim'}
      </button>

      {/* Recent estimates */}
      <div className="rl-section-title" style={{ marginTop: '22px' }}>Recent Estimates</div>
      {recent.length === 0 ? (
        <p className="rl-hint">No estimates yet.</p>
      ) : (
        <div className="rl-est-list">
          {recent.slice(0, 25).map(e => (
            <div key={e.id} className="rl-est-card">
              <div className="rl-est-main">
                <div className="rl-est-num">{e.estimate_number}</div>
                <div className="rl-est-client">{e.client}{e.contact_name ? ` · ${e.contact_name}` : ''}</div>
                <div className="rl-est-meta">{e.date_issued} · {e.price_basis === 'long' ? 'Long dist.' : 'Local'} · <span className={statusPill(e.status)}>{e.status}</span></div>
              </div>
              <div className="rl-est-side">
                <div className="rl-est-total">{fmtR(e.total ?? 0)}</div>
                <button type="button" className="rl-add-btn rl-add-btn-alt" onClick={() => resend(e.id)} disabled={sendingId === e.id}>
                  {sendingId === e.id ? 'Sending…' : 'Email to Kim'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
