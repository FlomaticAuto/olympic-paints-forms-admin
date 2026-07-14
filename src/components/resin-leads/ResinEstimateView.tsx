'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
interface Lead {
  id: string;
  lead_ref: string;
  company: string;
  contact_person: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  distance: 'Local' | 'Long Distance';
  street: string | null;
  city: string | null;
  province: string | null;
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
  pack: string;          // selected pack-size label (e.g. "190 KG Drum")
  packQty: string;       // number of packs (drums / flowbins), e.g. "3"
}
interface EstimateRow {
  id: string;
  estimate_number: string;
  client: string;
  contact_name: string | null;
  date_issued: string;
  status: string;
  price_basis: string;
  lead_ref: string | null;
  pdf_url: string | null;
  total?: number;
}

// Prefer the archived R2 copy; fall back to on-demand render (always current,
// and the only option for estimates that were never sent).
const pdfHref = (e: { id: string; pdf_url?: string | null }) =>
  e.pdf_url || `/api/resin-leads/estimate/${e.id}/pdf`;

const fmtR = (n: number) => 'R' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_PILL: Record<string, string> = {
  draft: 'rl-pill rl-pill-neutral', sent: 'rl-pill rl-pill-info',
  approved: 'rl-pill rl-pill-success', declined: 'rl-pill rl-pill-danger',
};
const statusPill = (s: string) => STATUS_PILL[s] ?? 'rl-pill rl-pill-neutral';
const normalizeDecimal = (raw: string) => raw.replace(',', '.');
let keySeq = 0;
const newKey = () => `l${keySeq++}`;
const emptyLine = (): LineDraft => ({ key: newKey(), product_id: '', product_code: null, description: '', category: null, unit: 'kg', qty: '', unit_price: '', pack: '', packQty: '' });

// Rebuild a form line from a saved DB row, recovering pack/packQty from the
// stored packaging string ("3 × 190 KG Drums") when present.
function rowToLine(r: Record<string, unknown>): LineDraft {
  const category = (r.category ?? null) as string | null;
  const qty = r.qty != null ? String(r.qty) : '';
  let pack = '', packQty = '';
  const packaging = typeof r.packaging === 'string' ? r.packaging : '';
  const m = packaging.match(/^\s*(\d+(?:\.\d+)?)\s*[×x]\s*(.+?)\s*$/i);
  if (m) {
    packQty = m[1];
    // match the pack label (e.g. "190 KG Drums" → "190 KG Drum") by size + unit
    const match = packsFor(category).find(p => packaging.includes(`${p.size} ${p.unit === 'kg' ? 'KG' : 'L'}`));
    if (match) pack = match.label;
  }
  return {
    key: newKey(),
    product_id: (r.product_id ?? '') as string || '',
    product_code: (r.product_code ?? null) as string | null,
    description: String(r.description ?? ''),
    category,
    unit: String(r.unit ?? 'kg'),
    qty,
    unit_price: r.unit_price != null ? String(r.unit_price) : '',
    pack,
    packQty,
  };
}

// Pack-size rules by product category. Selecting a pack sets the per-pack measure
// and unit; the line qty is (number of packs × pack size). Kim then enters the
// price per kg / litre. Resins ship in 190 kg drums; solvents/thinners in 200 L
// drums or 1000 L flowbins. `container` is the noun for the multiplier field.
interface Pack { label: string; size: number; unit: string; container: string }
const PACKS_BY_CATEGORY: Record<string, Pack[]> = {
  'Resin':           [{ label: '190 KG Drum', size: 190, unit: 'kg', container: 'Drum' }],
  'Solvent/Thinner': [
    { label: '1000 L Flowbin', size: 1000, unit: 'litres', container: 'Flowbin' },
    { label: '200 L Drum',     size: 200,  unit: 'litres', container: 'Drum' },
  ],
};
const packsFor = (category: string | null): Pack[] => (category && PACKS_BY_CATEGORY[category]) || [];
const packByLabel = (category: string | null, label: string): Pack | undefined =>
  packsFor(category).find(p => p.label === label);
// Pluralise the container noun for the count field / PDF (Drum→Drums, Flowbin→Flowbins).
const plural = (noun: string, n: number) => (n === 1 ? noun : `${noun}s`);

// Pack breakdown shown on the quote, e.g. "3 × 190 KG Drums". Empty for non-pack lines.
function packagingLabel(category: string | null, packLabel: string, packQty: string): string {
  const pack = packByLabel(category, packLabel);
  const n = parseFloat(packQty) || 0;
  if (!pack || n <= 0) return '';
  return `${n} × ${pack.size} ${pack.unit === 'kg' ? 'KG' : 'L'} ${plural(pack.container, n)}`;
}

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

  // Lead picker (search existing leads → auto-populate customer details)
  const [lead, setLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recent, setRecent] = useState<EstimateRow[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  // When set, we're editing an existing draft instead of creating a new estimate.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/resin-leads/products').then(r => r.json())
      .then((d: Product[]) => setCatalogue(Array.isArray(d) ? d : [])).catch(() => {});
    loadRecent();
  }, []);

  function loadRecent() {
    fetch('/api/resin-leads/estimate').then(r => r.json())
      .then((d: EstimateRow[]) => setRecent(Array.isArray(d) ? d : [])).catch(() => {});
  }

  // ── Lead search + auto-populate ──────────────────────────────────────────
  function searchLeads(q: string) {
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
  }

  function selectLead(l: Lead) {
    setLead(l);
    setResults([]);
    setQuery('');
    // Populate every customer detail we can from the lead.
    setClient(l.company ?? '');
    setContactName(l.contact_person ?? '');
    setContactEmail(l.email ?? '');
    setContactPhone(l.phone ?? l.mobile ?? '');
    setSite([l.street, l.city, l.province].filter(Boolean).join(', '));
    setPriceBasis(l.distance === 'Long Distance' ? 'long' : 'local');
    setMsg(null);
  }

  function clearLead() {
    // Unlink but keep whatever was typed so nothing is lost.
    setLead(null);
    setQuery('');
    setResults([]);
  }

  const priceOf = (p: Product): number | null =>
    priceBasis === 'long' ? (p.long_price ?? p.local_price) : (p.local_price ?? p.long_price);

  // Total measure for a line = number of packs × pack size (e.g. 3 × 190 = 570).
  const qtyFromPacks = (pack: Pack, packQty: string): string => {
    const n = parseFloat(packQty) || 0;
    return n > 0 ? String(+(n * pack.size).toFixed(3)) : '';
  };

  function selectProduct(key: string, id: string) {
    const p = catalogue.find(x => x.id === id);
    const pack = packsFor(p?.category ?? null)[0];   // default to first pack for the category
    setLines(prev => prev.map(l => l.key !== key ? l : {
      ...l,
      product_id: id,
      product_code: p?.code ?? null,
      description: p ? p.name : l.description,
      category: p?.category ?? null,
      // Pack products start at 1 pack; qty = 1 × size. Non-pack products (e.g.
      // charges like Drum Deposit) keep free-text qty and a neutral "ea" unit.
      pack: pack?.label ?? '',
      packQty: pack ? '1' : '',
      qty: pack ? qtyFromPacks(pack, '1') : l.qty,
      unit: pack?.unit ?? 'ea',
      unit_price: l.unit_price || (p && priceOf(p) != null ? String(priceOf(p)) : l.unit_price),
    }));
  }

  function selectPack(key: string, label: string) {
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const pack = packByLabel(l.category, label);
      if (!pack) return { ...l, pack: label };
      const packQty = l.packQty || '1';
      return { ...l, pack: label, unit: pack.unit, packQty, qty: qtyFromPacks(pack, packQty) };
    }));
  }

  // Kim types the number of drums / flowbins; qty (total kg/litres) follows.
  function setPackQty(key: string, raw: string) {
    const packQty = raw.replace(/[^\d.]/g, '');
    setLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const pack = packByLabel(l.category, l.pack);
      return pack ? { ...l, packQty, qty: qtyFromPacks(pack, packQty) } : { ...l, packQty };
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
    setLead(null); setQuery('');
    setEditingId(null); setEditingNumber(null);
  }

  function cancelEdit() {
    resetForm();
    setMsg(null);
  }

  // Save the estimate (create a new one, or PATCH the draft being edited),
  // then optionally render + email its PDF to Kim (which flips it to "sent").
  async function save(sendAfter: boolean) {
    setMsg(null);
    if (!client.trim()) { setMsg({ ok: false, text: 'Enter a client / company name.' }); return; }
    const payloadLines = lines
      .filter(l => l.product_id || l.description.trim())
      .map(l => ({
        product_id: l.product_id || null, product_code: l.product_code, description: l.description,
        category: l.category, unit: l.unit, qty: l.qty, unit_price: l.unit_price,
        packaging: packagingLabel(l.category, l.pack, l.packQty) || null,
      }));
    if (payloadLines.length === 0) { setMsg({ ok: false, text: 'Add at least one product line.' }); return; }

    const payload = {
      client, contact_name: contactName, contact_email: contactEmail, contact_phone: contactPhone,
      site, valid_until: validUntil || null, price_basis: priceBasis, notes,
      prepared_by: rep, lines: payloadLines,
      lead_id: lead?.id ?? null, lead_ref: lead?.lead_ref ?? null,
    };

    setBusy(true);
    try {
      // Update the draft in place, or create a new estimate.
      const res = editingId
        ? await fetch(`/api/resin-leads/estimate/${editingId}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          })
        : await fetch('/api/resin-leads/estimate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      const id = editingId ?? data.id;
      const number = editingNumber ?? data.estimate_number;

      if (!sendAfter) {
        setMsg({ ok: true, text: `Draft ${number} saved. You can email it later from the list below.` });
        resetForm();
        loadRecent();
        return;
      }

      setMsg({ ok: true, text: `Saved ${number}. Emailing PDF to Kim…` });
      const sendRes = await fetch(`/api/resin-leads/estimate/${id}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) throw new Error(sendData.error ?? 'Email failed');

      setMsg({ ok: true, text: `${number} emailed to ${(sendData.sentTo ?? []).join(', ')}.` });
      resetForm();
      loadRecent();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  // Load a draft estimate back into the form for editing.
  async function editDraft(id: string) {
    setLoadingId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/resin-leads/estimate/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load estimate');
      const est = data.estimate as Record<string, unknown>;
      const estLines = (data.lines ?? []) as Array<Record<string, unknown>>;

      setEditingId(id);
      setEditingNumber(String(est.estimate_number ?? ''));
      setClient(String(est.client ?? ''));
      setContactName(String(est.contact_name ?? ''));
      setContactEmail(String(est.contact_email ?? ''));
      setContactPhone(String(est.contact_phone ?? ''));
      setSite(String(est.site ?? ''));
      setValidUntil(est.valid_until ? String(est.valid_until) : '');
      setNotes(String(est.notes ?? ''));
      setPriceBasis(est.price_basis === 'long' ? 'long' : 'local');
      setLead(null); setQuery('');
      setLines(estLines.length ? estLines.map(rowToLine) : [emptyLine()]);
      setMsg({ ok: true, text: `Editing draft ${est.estimate_number}. Make changes, then Save Draft or Save & Email.` });
      // scroll back up to the form
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not load estimate.' });
    } finally {
      setLoadingId(null);
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
      {editingId && (
        <div className="rl-editing-banner">
          <span>✎ Editing draft <b>{editingNumber}</b></span>
          <button type="button" className="rl-clear-btn" onClick={cancelEdit} disabled={busy}>Start new instead</button>
        </div>
      )}
      <div className="rl-section-title">
        Customer
        <span className="rl-section-note">Search an existing lead to auto-fill, or type a new company</span>
      </div>

      {!lead ? (
        <div className="rl-field rl-search-field">
          <label className="rl-label">Client / Company <span className="rl-req">*</span></label>
          <input
            className="rl-input"
            value={query || client}
            autoComplete="off"
            placeholder="Search leads by company, contact, city or ref…"
            onChange={e => {
              const v = e.target.value;
              setQuery(v);
              setClient(v);            // typing also fills the client field (walk-in / new company)
              searchLeads(v);
            }}
          />
          {searching && <p className="rl-hint">Searching leads…</p>}
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
            <p className="rl-hint">No matching lead — this will be quoted as a new company.</p>
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
            {(lead.phone || lead.mobile) && <div><span className="rl-lc-l">Phone</span><span className="rl-lc-v">{lead.phone ?? lead.mobile}</span></div>}
            {lead.email && <div><span className="rl-lc-l">Email</span><span className="rl-lc-v">{lead.email}</span></div>}
            {lead.city && <div><span className="rl-lc-l">City</span><span className="rl-lc-v">{lead.city}{lead.province ? `, ${lead.province}` : ''}</span></div>}
            <div><span className="rl-lc-l">Ref</span><span className="rl-lc-v">{lead.lead_ref}</span></div>
          </div>
          <button type="button" className="rl-clear-btn" onClick={clearLead}>Change lead</button>
        </div>
      )}

      {lead && (
        <div className="rl-field">
          <label className="rl-label">Client / Company <span className="rl-req">*</span></label>
          <input className="rl-input" value={client} onChange={e => setClient(e.target.value)} placeholder="Company name" autoComplete="off" />
        </div>
      )}
      <div className="rl-section-title">
        Contact &amp; site
        {lead && <span className="rl-section-note">Pulled from {lead.lead_ref} · editable</span>}
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
              {(() => {
                const pack = packByLabel(l.category, l.pack);
                const containerLabel = pack ? plural(pack.container, parseFloat(l.packQty) || 0) : '';
                return packsFor(l.category).length > 0 && (
                  <div className="rl-row-2">
                    <div className="rl-field">
                      <label className="rl-label">Pack size</label>
                      <select className="rl-input" value={l.pack} onChange={e => selectPack(l.key, e.target.value)}>
                        {packsFor(l.category).map(pk => (
                          <option key={pk.label} value={pk.label}>{pk.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">No. of {containerLabel || pack?.container || 'packs'}</label>
                      <input className="rl-input" type="text" inputMode="numeric" placeholder="1"
                        value={l.packQty} onChange={e => setPackQty(l.key, e.target.value)} />
                    </div>
                  </div>
                );
              })()}
              <div className="rl-item-grid">
                <div className="rl-field">
                  <label className="rl-label">Unit Price (R{l.unit === 'litres' ? '/L' : l.unit === 'kg' ? '/kg' : ''})</label>
                  <input className="rl-input" type="text" inputMode="decimal" placeholder="Type price"
                    value={l.unit_price} onChange={e => setField(l.key, { unit_price: normalizeDecimal(e.target.value) })} />
                  {listRef != null && <p className="rl-ref">List ref: {fmtR(listRef)}</p>}
                </div>
                <div className="rl-field">
                  <label className="rl-label">Qty ({l.unit}){l.pack ? ' · auto' : ''}</label>
                  <input className="rl-input" type="text" inputMode="decimal" placeholder="0"
                    value={l.qty} readOnly={!!l.pack}
                    onChange={e => setField(l.key, { qty: normalizeDecimal(e.target.value) })} />
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

      <div className="rl-est-submit-row">
        <button type="button" className="rl-btn rl-btn-ghost" onClick={() => save(false)} disabled={busy}>
          {busy ? 'Saving…' : editingId ? 'Save Draft' : 'Save as Draft'}
        </button>
        <button type="button" className="rl-submit rl-submit-inline" onClick={() => save(true)} disabled={busy}>
          {busy ? 'Working…' : editingId ? 'Save & Email PDF to Kim' : 'Create & Email PDF to Kim'}
        </button>
        {editingId && (
          <button type="button" className="rl-btn rl-btn-ghost" onClick={cancelEdit} disabled={busy}>Cancel</button>
        )}
      </div>

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
                <div className="rl-est-meta">{e.date_issued} · {e.price_basis === 'long' ? 'Long dist.' : 'Local'}{e.lead_ref ? ` · ${e.lead_ref}` : ''} · <span className={statusPill(e.status)}>{e.status}</span></div>
              </div>
              <div className="rl-est-side">
                <div className="rl-est-total">{fmtR(e.total ?? 0)}</div>
                <div className="rl-est-actions">
                  {e.status === 'draft' && (
                    <button type="button" className="rl-add-btn" onClick={() => editDraft(e.id)} disabled={loadingId === e.id || editingId === e.id}>
                      {loadingId === e.id ? 'Loading…' : editingId === e.id ? 'Editing…' : 'Edit'}
                    </button>
                  )}
                  <a className="rl-add-btn" href={pdfHref(e)} target="_blank" rel="noopener noreferrer">View PDF</a>
                  <button type="button" className="rl-add-btn rl-add-btn-alt" onClick={() => resend(e.id)} disabled={sendingId === e.id}>
                    {sendingId === e.id ? 'Sending…' : e.status === 'draft' ? 'Email to Kim' : 'Re-email'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
