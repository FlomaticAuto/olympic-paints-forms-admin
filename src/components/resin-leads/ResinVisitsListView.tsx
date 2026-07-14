'use client';
import { useEffect, useMemo, useState } from 'react';
import { VISIT_OUTCOMES, type ResinLeadVisit, type ResinVisitProductLine, type ResinVisitEdit } from '@/lib/resinCrm/types';
import { fmtR, fmtDate, stagePillClass } from '@/lib/resinCrm/format';

// iOS renders a comma on the decimal keypad for South-African locales, but
// Number() only accepts a period — mirror the capture form's behaviour.
function normalizeDecimal(raw: string): string { return raw.replace(',', '.'); }

// Editable copy of a product line (all strings, like the capture form).
interface EditLine {
  product_id: string;
  code: string;
  name: string;
  our_price: string;
  est_qty: string;
  order_every: string;
  order_unit: string;
  supplier: string;
  supplier_price: string;
  notes: string;
}
function toEditLine(p: ResinVisitProductLine): EditLine {
  return {
    product_id: p.product_id ?? '',
    code: p.code ?? '',
    name: p.name ?? '',
    our_price: p.our_price != null ? String(p.our_price) : '',
    est_qty: p.est_qty != null ? String(p.est_qty) : '',
    order_every: p.order_every != null ? String(p.order_every) : '',
    order_unit: p.order_unit ?? 'Months',
    supplier: p.current_supplier ?? '',
    supplier_price: p.current_supplier_price != null ? String(p.current_supplier_price) : '',
    notes: p.notes ?? '',
  };
}

// Editable draft of a whole visit.
interface Draft {
  visit_date: string;
  outcome: string;
  next_follow_up: string;
  notes: string;
  items: EditLine[];
  photos: string[]; // carried through unchanged
}
function toDraft(v: ResinLeadVisit): Draft {
  return {
    visit_date: v.visit_date ?? '',
    outcome: v.outcome ?? '',
    next_follow_up: v.next_follow_up ?? '',
    notes: v.notes ?? '',
    items: (v.products ?? []).map(toEditLine),
    photos: [], // repopulated from the raw row below (not on the typed interface)
  };
}

export default function ResinVisitsListView() {
  const [visits, setVisits] = useState<ResinLeadVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState('All');
  const [rep, setRep] = useState('All');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
  // Which visit row is expanded to show details.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleRow = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  function load() {
    setLoading(true); setFailed(false);
    fetch('/api/resin-leads/visit')
      .then((r) => r.json())
      .then((d) => setVisits(Array.isArray(d) ? d : []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const outcomeOptions = useMemo(() => ['All', ...VISIT_OUTCOMES], []);
  const repOptions = useMemo(
    () => ['All', ...Array.from(new Set(visits.map((v) => v.rep).filter(Boolean) as string[])).sort()],
    [visits],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visits.filter((v) => {
      if (outcome !== 'All' && v.outcome !== outcome) return false;
      if (rep !== 'All' && v.rep !== rep) return false;
      if (!q) return true;
      return [v.company, v.rep, v.notes, v.visit_ref]
        .filter(Boolean)
        .some((val) => (val as string).toLowerCase().includes(q));
    });
  }, [visits, query, outcome, rep]);

  function startEdit(v: ResinLeadVisit) {
    const d = toDraft(v);
    // photos aren't on the typed interface but come through on the raw row.
    d.photos = Array.isArray((v as unknown as { photos?: unknown }).photos)
      ? ((v as unknown as { photos: unknown[] }).photos.filter((u): u is string => typeof u === 'string'))
      : [];
    setDraft(d);
    setEditingId(v.id);
    setExpandedId(v.id);   // keep the row open while editing
    setEditError(null);
  }
  function cancelEdit() {
    setEditingId(null); setDraft(null); setEditError(null); setSavingEdit(false);
  }
  function patchDraft(patch: Partial<Draft>) { setDraft((p) => (p ? { ...p, ...patch } : p)); }
  function patchLine(i: number, patch: Partial<EditLine>) {
    setDraft((p) => p ? { ...p, items: p.items.map((it, idx) => idx === i ? { ...it, ...patch } : it) } : p);
  }
  function addLine() {
    setDraft((p) => p ? {
      ...p, items: [...p.items, { product_id: '', code: '', name: '', our_price: '', est_qty: '',
        order_every: '', order_unit: 'Months', supplier: '', supplier_price: '', notes: '' }],
    } : p);
  }
  function removeLine(i: number) {
    setDraft((p) => p ? { ...p, items: p.items.filter((_, idx) => idx !== i) } : p);
  }
  function lineValue(it: EditLine): number {
    return (Number(it.our_price) || 0) * (Number(it.est_qty) || 0);
  }
  const draftTotal = draft ? draft.items.reduce((s, it) => s + lineValue(it), 0) : 0;

  async function saveEdit(v: ResinLeadVisit) {
    if (!draft) return;
    if (!draft.visit_date) { setEditError('Visit date is required.'); return; }
    setSavingEdit(true); setEditError(null);
    const products = draft.items
      .filter((it) => it.product_id || it.name.trim())
      .map((it) => ({
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
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: v.id,
          edited_by: v.rep ?? null,
          visit_date: draft.visit_date,
          outcome: draft.outcome || null,
          next_follow_up: draft.next_follow_up || null,
          notes: draft.notes || null,
          photos: draft.photos,
          products,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setEditError(j.error ?? 'Save failed.'); setSavingEdit(false); return; }
      cancelEdit();
      load(); // refresh list + history
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Network error');
      setSavingEdit(false);
    }
  }

  function toggleHistory(id: string) {
    setOpenHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="rl-form">
      <div className="rl-section-title">Leads Visited</div>
      <div className="rl-report-toolbar">
        <span className="rl-report-count">{filtered.length} of {visits.length} visits</span>
        <div className="rl-report-filters">
          <input className="rl-input" placeholder="Search company, rep, notes…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="rl-input rl-input-sm" value={rep} onChange={(e) => setRep(e.target.value)}>
            {repOptions.map((r) => <option key={r} value={r}>{r === 'All' ? 'All reps' : r}</option>)}
          </select>
          <select className="rl-input rl-input-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {outcomeOptions.map((o) => <option key={o} value={o}>{o === 'All' ? 'All outcomes' : o}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rl-empty"><div className="rl-empty-body">Loading…</div></div>
      ) : failed ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">⚠️</div>
          <div className="rl-empty-title">Couldn't load visits</div>
          <div className="rl-empty-body">Try again in a moment.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">🚗</div>
          <div className="rl-empty-title">No visits match</div>
          <div className="rl-empty-body">Try clearing the search or filters.</div>
        </div>
      ) : (
        <div className="rl-vlist">
          {/* Column header (desktop) */}
          <div className="rl-vhead">
            <span>Company</span>
            <span>Visit Date</span>
            <span>Rep</span>
            <span>Outcome</span>
            <span className="rl-vc-r">Est. Value</span>
            <span />
          </div>
          {filtered.map((v) => {
            const isEditing = editingId === v.id;
            const edits = v.edits ?? [];
            const historyOpen = openHistory.has(v.id);
            const isOpen = expandedId === v.id;
            return (
            <div key={v.id} className={`rl-vrow-wrap${isOpen ? ' is-open' : ''}`}>
              {/* Summary row — click to expand */}
              <button type="button" className="rl-vrow" onClick={() => toggleRow(v.id)} aria-expanded={isOpen}>
                <span className="rl-vc-company">{v.company}</span>
                <span className="rl-vc" data-l="Date">{fmtDate(v.visit_date)}</span>
                <span className="rl-vc" data-l="Rep">{v.rep ?? '—'}</span>
                <span className="rl-vc-outcome"><span className={stagePillClass(v.outcome)}>{v.outcome ?? '—'}</span></span>
                <span className="rl-vc-r rl-vc-total">{fmtR(v.total)}</span>
                <span className="rl-vchevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
              <div className="rl-vbody">
              <div className="rl-lead-grid">
                <div><span className="rl-lc-l">Visit Date</span><span className="rl-lc-v">{fmtDate(v.visit_date)}</span></div>
                {v.rep && <div><span className="rl-lc-l">Rep</span><span className="rl-lc-v">{v.rep}</span></div>}
                <div><span className="rl-lc-l">Products</span><span className="rl-lc-v">{v.products?.length ?? 0}</span></div>
                {v.next_follow_up && <div><span className="rl-lc-l">Next Follow-up</span><span className="rl-lc-v">{fmtDate(v.next_follow_up)}</span></div>}
                <div><span className="rl-lc-l">Ref</span><span className="rl-lc-v">{v.visit_ref}</span></div>
                <div><span className="rl-lc-l">Est. Value</span><span className="rl-lc-v">{fmtR(v.total)}</span></div>
              </div>
              {v.notes && <p className="rl-hint">{v.notes}</p>}

              {/* Card actions */}
              {!isEditing && (
                <div className="rl-visit-actions">
                  <button type="button" className="rl-clear-btn" onClick={() => startEdit(v)}>Edit Visit</button>
                  {edits.length > 0 && (
                    <button type="button" className="rl-history-toggle" onClick={() => toggleHistory(v.id)}>
                      {historyOpen ? '▾' : '▸'} {edits.length} edit{edits.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              )}

              {/* Change history */}
              {!isEditing && historyOpen && edits.length > 0 && (
                <div className="rl-history">
                  {edits.map((e) => <EditEntry key={e.id} edit={e} />)}
                </div>
              )}

              {/* Inline edit panel */}
              {isEditing && draft && (
                <div className="rl-edit-panel">
                  <div className="rl-edit-title">Edit Visit · {v.visit_ref}</div>
                  <div className="rl-row-2">
                    <div className="rl-field">
                      <label className="rl-label">Visit Date <span className="rl-req">*</span></label>
                      <input className="rl-input" type="date" value={draft.visit_date}
                        onChange={(e) => patchDraft({ visit_date: e.target.value })} />
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">Outcome / Stage</label>
                      <select className="rl-input" value={draft.outcome}
                        onChange={(e) => patchDraft({ outcome: e.target.value })}>
                        <option value="">— Select —</option>
                        {VISIT_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="rl-section-title">Products of Interest</div>
                  <div className="rl-items">
                    {draft.items.map((it, i) => (
                      <div key={i} className="rl-item-card">
                        <div className="rl-item-card-head">
                          <input className="rl-input rl-item-product" value={it.name}
                            placeholder="Product name"
                            onChange={(e) => patchLine(i, { name: e.target.value })} />
                          <button type="button" className="rl-item-del" onClick={() => removeLine(i)}
                            aria-label="Remove product" disabled={draft.items.length === 1}>×</button>
                        </div>
                        <div className="rl-item-grid">
                          <div className="rl-field">
                            <label className="rl-label">Our Price (R)</label>
                            <input className="rl-input" type="text" inputMode="decimal" placeholder="0"
                              value={it.our_price}
                              onChange={(e) => patchLine(i, { our_price: normalizeDecimal(e.target.value) })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Est. Qty (kg)</label>
                            <input className="rl-input" type="text" inputMode="decimal" placeholder="0"
                              value={it.est_qty}
                              onChange={(e) => patchLine(i, { est_qty: normalizeDecimal(e.target.value) })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Order Every</label>
                            <div className="rl-period">
                              <input className="rl-input rl-period-n" type="number" inputMode="numeric" min="0"
                                placeholder="0" value={it.order_every}
                                onChange={(e) => patchLine(i, { order_every: e.target.value })} />
                              <select className="rl-input rl-period-u" value={it.order_unit}
                                onChange={(e) => patchLine(i, { order_unit: e.target.value })}>
                                <option value="Weeks">Weeks</option>
                                <option value="Months">Months</option>
                              </select>
                            </div>
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Current Supplier</label>
                            <input className="rl-input" autoComplete="off" placeholder="Who supplies them now"
                              value={it.supplier}
                              onChange={(e) => patchLine(i, { supplier: e.target.value })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Their Price (R)</label>
                            <input className="rl-input" type="text" inputMode="decimal" placeholder="0"
                              value={it.supplier_price}
                              onChange={(e) => patchLine(i, { supplier_price: normalizeDecimal(e.target.value) })} />
                          </div>
                          <div className="rl-field">
                            <label className="rl-label">Est. Value</label>
                            <div className="rl-item-value-v">{fmtR(lineValue(it))}</div>
                          </div>
                        </div>
                        <div className="rl-field">
                          <label className="rl-label">Comments</label>
                          <textarea className="rl-input rl-item-notes" rows={2} placeholder="Notes on this product…"
                            value={it.notes}
                            onChange={(e) => patchLine(i, { notes: e.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rl-items-foot">
                    <button type="button" className="rl-add-btn" onClick={addLine}>+ Add product line</button>
                    <div className="rl-grand">
                      <span className="rl-grand-l">Est. Value</span>
                      <span className="rl-grand-v">{fmtR(draftTotal)}</span>
                    </div>
                  </div>

                  <div className="rl-section-title">Follow-up & Notes</div>
                  <div className="rl-field">
                    <label className="rl-label">Next Follow-up Date</label>
                    <input className="rl-input rl-input-sm" type="date" value={draft.next_follow_up}
                      onChange={(e) => patchDraft({ next_follow_up: e.target.value })} />
                  </div>
                  <div className="rl-field">
                    <label className="rl-label">Visit Notes</label>
                    <textarea className="rl-input rl-textarea" value={draft.notes}
                      onChange={(e) => patchDraft({ notes: e.target.value })}
                      placeholder="What was discussed, next steps, objections…" />
                  </div>

                  {editError && <p className="rl-error">{editError}</p>}
                  <div className="rl-edit-btns">
                    <button className="rl-btn rl-btn-primary rl-btn-sm" onClick={() => saveEdit(v)} disabled={savingEdit}>
                      {savingEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button className="rl-clear-btn" onClick={cancelEdit} disabled={savingEdit}>Cancel</button>
                  </div>
                </div>
              )}
              </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: extraCss }} />
    </div>
  );
}

function EditEntry({ edit }: { edit: ResinVisitEdit }) {
  const when = fmtDateTime(edit.edited_at);
  return (
    <div className="rl-history-entry">
      <div className="rl-history-head">
        <span className="rl-history-who">{edit.edited_by ?? 'Someone'}</span>
        <span className="rl-history-when">{when}</span>
      </div>
      <ul className="rl-history-changes">
        {edit.changes.map((c, i) => (
          <li key={i}>
            <span className="rl-history-field">{c.label}:</span>{' '}
            {c.field === 'notes'
              ? <span className="rl-history-val">edited</span>
              : <><span className="rl-history-from">{c.from}</span> → <span className="rl-history-to">{c.to}</span></>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Edit-panel + history styles (scoped additions; base tokens come from the form's global CSS).
const extraCss = `
  /* ── Visits list (compact rows) ── */
  .rl-vlist { display:flex; flex-direction:column; border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  /* Shared column template for header + rows. */
  .rl-vhead, .rl-vrow {
    display:grid; grid-template-columns:1.6fr 0.9fr 0.9fr 1.1fr 0.9fr 28px;
    gap:12px; align-items:center; padding:9px 14px; text-align:left;
  }
  .rl-vhead {
    background:var(--sunken); border-bottom:1px solid var(--border);
    font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:10px;
    text-transform:uppercase; letter-spacing:0.09em; color:var(--muted);
  }
  .rl-vrow {
    width:100%; background:transparent; border:0; cursor:pointer; font:inherit; color:var(--text);
    border-bottom:1px solid var(--border-s); transition:background .12s;
  }
  .rl-vrow:hover { background:var(--section-bg); }
  .rl-vrow-wrap:last-child .rl-vrow { border-bottom:0; }
  .rl-vrow-wrap.is-open .rl-vrow { background:var(--section-bg); border-bottom:1px solid var(--border); }
  .rl-vc-company { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:15px; text-transform:uppercase; letter-spacing:0.01em; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rl-vc { font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rl-vc-r { text-align:right; }
  .rl-vc-total { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:15px; color:var(--text); }
  .rl-vc-outcome .rl-pill { font-size:9px; padding:3px 8px; }
  .rl-vchevron { color:var(--gold); font-size:12px; text-align:center; }
  .rl-vbody { padding:12px 14px 14px; background:var(--base); border-bottom:1px solid var(--border-s); display:flex; flex-direction:column; gap:11px; }
  .rl-vrow-wrap:last-child .rl-vbody { border-bottom:0; }
  /* Mobile: flex layout — company + value on the first line, then meta wraps below. */
  @media (max-width:640px) {
    .rl-vhead { display:none; }
    .rl-vrow {
      display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; padding:11px 13px;
    }
    .rl-vc-company { flex:1 1 auto; order:1; font-size:15px; min-width:0; }
    .rl-vc-total   { order:2; margin-left:auto; }
    .rl-vchevron   { order:3; }
    /* meta cells wrap onto the second line, full width */
    .rl-vrow > .rl-vc { order:4; font-size:12px; }
    .rl-vc[data-l='Date'] { flex-basis:100%; margin-top:1px; }
    .rl-vc[data-l]::after { content:'·'; color:var(--dim); margin-left:6px; }
    .rl-vc-outcome { order:5; }
    .rl-vc-outcome .rl-pill { font-size:9px; }
  }

  .rl-visit-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:2px; }
  .rl-history-toggle {
    background:transparent; border:0; color:var(--gold); cursor:pointer; padding:6px 4px;
    font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:12px;
    text-transform:uppercase; letter-spacing:0.06em;
  }
  .rl-history {
    display:flex; flex-direction:column; gap:10px; margin-top:4px;
    border-top:1px dashed var(--border); padding-top:10px;
  }
  .rl-history-entry { background:var(--sunken); border:1px solid var(--border-s); border-radius:8px; padding:10px 12px; }
  .rl-history-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-bottom:5px; }
  .rl-history-who { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:var(--text); }
  .rl-history-when { font-size:11px; color:var(--dim); }
  .rl-history-changes { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; }
  .rl-history-changes li { font-size:12px; color:var(--muted); line-height:1.4; }
  .rl-history-field { font-family:'Barlow Condensed',sans-serif; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--dim); font-size:11px; }
  .rl-history-from { color:var(--muted); text-decoration:line-through; text-decoration-color:var(--dim); }
  .rl-history-to { color:var(--text); font-weight:600; }
  .rl-history-val { color:var(--text); font-weight:600; }

  .rl-edit-panel {
    margin-top:6px; border-top:1px dashed var(--border); padding-top:12px;
    display:flex; flex-direction:column; gap:13px;
  }
  .rl-edit-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:14px; text-transform:uppercase; letter-spacing:0.04em; color:var(--gold); }
  .rl-edit-btns { display:flex; gap:10px; align-items:center; margin-top:4px; }
`;
