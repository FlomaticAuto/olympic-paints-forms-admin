'use client';
import { useEffect, useMemo, useState } from 'react';
import { LEAD_STATUSES, type ResinLead, type ResinLeadEdit } from '@/lib/resinCrm/types';
import { fmtDate, stagePillClass, distancePillClass } from '@/lib/resinCrm/format';

// Editable draft of a lead — all fields as strings, like the capture form.
interface Draft {
  company: string;
  contact_person: string;
  phone: string;
  mobile: string;
  email: string;
  lead_source: string;
  lead_status: string;
  distance: 'Local' | 'Long Distance';
  street: string;
  city: string;
  province: string;
  postal_code: string;
  rep: string;
  notes: string;
}
const toDraft = (l: ResinLead): Draft => ({
  company: l.company ?? '',
  contact_person: l.contact_person ?? '',
  phone: l.phone ?? '',
  mobile: l.mobile ?? '',
  email: l.email ?? '',
  lead_source: l.lead_source ?? '',
  lead_status: l.lead_status ?? 'New',
  distance: l.distance === 'Long Distance' ? 'Long Distance' : 'Local',
  street: l.street ?? '',
  city: l.city ?? '',
  province: l.province ?? '',
  postal_code: l.postal_code ?? '',
  rep: l.rep ?? '',
  notes: l.notes ?? '',
});

export default function ResinLeadsListView() {
  const [leads, setLeads] = useState<ResinLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());

  function load() {
    setLoading(true);
    fetch('/api/resin-leads/lead')
      .then((r) => r.json())
      .then((d) => { setLeads(Array.isArray(d) ? d : []); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const statusOptions = useMemo(() => ['All', ...LEAD_STATUSES], []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== 'All' && l.lead_status !== status) return false;
      if (!q) return true;
      return [l.company, l.contact_person, l.city, l.rep, l.lead_ref]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [leads, query, status]);

  function startEdit(l: ResinLead) {
    setDraft(toDraft(l));
    setEditingId(l.id);
    setEditError(null);
  }
  function cancelEdit() {
    setEditingId(null); setDraft(null); setEditError(null); setSaving(false);
  }
  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  async function saveEdit(l: ResinLead) {
    if (!draft) return;
    if (!draft.company.trim()) { setEditError('Company is required.'); return; }
    setSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/resin-leads/lead', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: l.id, edited_by: l.rep ?? null, ...draft }),
      });
      const j = await res.json();
      if (!res.ok) { setEditError(j.error ?? 'Save failed.'); setSaving(false); return; }
      cancelEdit();
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Network error');
      setSaving(false);
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
      <div className="rl-section-title">Leads Loaded</div>
      <div className="rl-report-toolbar">
        <span className="rl-report-count">{filtered.length} of {leads.length} leads</span>
        <div className="rl-report-filters">
          <input className="rl-input" placeholder="Search company, contact, city, rep…"
            value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="rl-input rl-input-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rl-empty"><div className="rl-empty-body">Loading…</div></div>
      ) : failed ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">⚠️</div>
          <div className="rl-empty-title">Couldn't load leads</div>
          <div className="rl-empty-body">Try again in a moment.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">📋</div>
          <div className="rl-empty-title">No leads match</div>
          <div className="rl-empty-body">Try clearing the search or status filter.</div>
        </div>
      ) : (
        <div className="rl-items">
          {filtered.map((l) => {
            const isEditing = editingId === l.id;
            const edits = l.edits ?? [];
            const historyOpen = openHistory.has(l.id);
            return (
              <div key={l.id} className="rl-lead-card">
                <div className="rl-lead-card-top">
                  <span className="rl-lead-company">{l.company}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={stagePillClass(l.lead_status)}>{l.lead_status ?? 'New'}</span>
                    <span className={distancePillClass(l.distance)}>{l.distance}</span>
                  </div>
                </div>
                <div className="rl-lead-grid">
                  {l.contact_person && <div><span className="rl-lc-l">Contact</span><span className="rl-lc-v">{l.contact_person}</span></div>}
                  {(l.mobile || l.phone) && <div><span className="rl-lc-l">Phone</span><span className="rl-lc-v">{l.mobile || l.phone}</span></div>}
                  {l.email && <div><span className="rl-lc-l">Email</span><span className="rl-lc-v">{l.email}</span></div>}
                  {l.city && <div><span className="rl-lc-l">City</span><span className="rl-lc-v">{l.city}{l.province ? `, ${l.province}` : ''}</span></div>}
                  {l.rep && <div><span className="rl-lc-l">Rep</span><span className="rl-lc-v">{l.rep}</span></div>}
                  {l.lead_source && <div><span className="rl-lc-l">Source</span><span className="rl-lc-v">{l.lead_source}</span></div>}
                  <div><span className="rl-lc-l">Captured</span><span className="rl-lc-v">{fmtDate(l.created_at)}</span></div>
                  <div><span className="rl-lc-l">Ref</span><span className="rl-lc-v">{l.lead_ref}</span></div>
                </div>
                {l.notes && <p className="rl-hint">{l.notes}</p>}

                {/* Card actions */}
                {!isEditing && (
                  <div className="rl-visit-actions">
                    <button type="button" className="rl-clear-btn" onClick={() => startEdit(l)}>Edit Lead</button>
                    {edits.length > 0 && (
                      <button type="button" className="rl-history-toggle" onClick={() => toggleHistory(l.id)}>
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
                    <div className="rl-edit-title">Edit Lead · {l.lead_ref}</div>
                    <div className="rl-field">
                      <label className="rl-label">Company <span className="rl-req">*</span></label>
                      <input className="rl-input" value={draft.company} onChange={(e) => patchDraft({ company: e.target.value })} autoComplete="off" />
                    </div>
                    <div className="rl-row-2">
                      <div className="rl-field">
                        <label className="rl-label">Contact Person</label>
                        <input className="rl-input" value={draft.contact_person} onChange={(e) => patchDraft({ contact_person: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="rl-field">
                        <label className="rl-label">Email</label>
                        <input className="rl-input" type="email" value={draft.email} onChange={(e) => patchDraft({ email: e.target.value })} autoComplete="off" />
                      </div>
                    </div>
                    <div className="rl-row-2">
                      <div className="rl-field">
                        <label className="rl-label">Phone</label>
                        <input className="rl-input" value={draft.phone} onChange={(e) => patchDraft({ phone: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="rl-field">
                        <label className="rl-label">Mobile</label>
                        <input className="rl-input" value={draft.mobile} onChange={(e) => patchDraft({ mobile: e.target.value })} autoComplete="off" />
                      </div>
                    </div>
                    <div className="rl-row-2">
                      <div className="rl-field">
                        <label className="rl-label">Status</label>
                        <select className="rl-input" value={draft.lead_status} onChange={(e) => patchDraft({ lead_status: e.target.value })}>
                          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="rl-field">
                        <label className="rl-label">Distance</label>
                        <select className="rl-input" value={draft.distance} onChange={(e) => patchDraft({ distance: e.target.value as 'Local' | 'Long Distance' })}>
                          <option value="Local">Local</option>
                          <option value="Long Distance">Long Distance</option>
                        </select>
                      </div>
                    </div>
                    <div className="rl-row-2">
                      <div className="rl-field">
                        <label className="rl-label">Rep</label>
                        <input className="rl-input" value={draft.rep} onChange={(e) => patchDraft({ rep: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="rl-field">
                        <label className="rl-label">Lead Source</label>
                        <input className="rl-input" value={draft.lead_source} onChange={(e) => patchDraft({ lead_source: e.target.value })} autoComplete="off" />
                      </div>
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">Street</label>
                      <input className="rl-input" value={draft.street} onChange={(e) => patchDraft({ street: e.target.value })} autoComplete="off" />
                    </div>
                    <div className="rl-row-2">
                      <div className="rl-field">
                        <label className="rl-label">City</label>
                        <input className="rl-input" value={draft.city} onChange={(e) => patchDraft({ city: e.target.value })} autoComplete="off" />
                      </div>
                      <div className="rl-field">
                        <label className="rl-label">Province</label>
                        <input className="rl-input" value={draft.province} onChange={(e) => patchDraft({ province: e.target.value })} autoComplete="off" />
                      </div>
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">Postal Code</label>
                      <input className="rl-input rl-input-sm" value={draft.postal_code} onChange={(e) => patchDraft({ postal_code: e.target.value })} autoComplete="off" />
                    </div>
                    <div className="rl-field">
                      <label className="rl-label">Notes</label>
                      <textarea className="rl-input rl-textarea" value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })}
                        placeholder="Anything worth recording about this lead…" />
                    </div>

                    {editError && <p className="rl-error">{editError}</p>}
                    <div className="rl-edit-btns">
                      <button className="rl-btn rl-btn-primary rl-btn-sm" onClick={() => saveEdit(l)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button className="rl-clear-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
                    </div>
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

function EditEntry({ edit }: { edit: ResinLeadEdit }) {
  return (
    <div className="rl-history-entry">
      <div className="rl-history-head">
        <span className="rl-history-who">{edit.edited_by ?? 'Someone'}</span>
        <span className="rl-history-when">{fmtDateTime(edit.edited_at)}</span>
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
