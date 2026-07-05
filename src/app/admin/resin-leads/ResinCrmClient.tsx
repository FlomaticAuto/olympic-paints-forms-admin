'use client';
import { useMemo, useState } from 'react';
import type {
  ResinLead,
  ResinLeadVisit,
  CompetitorPriceRow,
  CompetitorFootprintRow,
  FieldNote,
  StatTiles,
} from '@/lib/resinCrm/types';
import { LEAD_STATUSES, VISIT_OUTCOMES } from '@/lib/resinCrm/types';

interface Props {
  leads: ResinLead[];
  visits: ResinLeadVisit[];
  competitorPricing: CompetitorPriceRow[];
  competitorFootprint: CompetitorFootprintRow[];
  fieldNotes: FieldNote[];
  stats: StatTiles;
  loadErrors: string[];
}

type Tab = 'leads' | 'visits' | 'intel';

function fmtR(n: number | null): string {
  return n == null ? '—' : 'R' + n.toFixed(2);
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
// Single shared map for both lead-status and visit-outcome badges — the two
// vocabularies overlap (Won, Lost, Negotiating, Quoted) and previously drifted
// (e.g. "Quoted" was styled differently in each) since they were hardcoded twice.
const STAGE_BADGE_CLASS: Record<string, string> = {
  Won: 'badge badge-success',
  'Order Placed': 'badge badge-success',
  Lost: 'badge rc-badge-danger',
  'Not Interested': 'badge rc-badge-danger',
  Negotiating: 'badge badge-warning',
  Quoted: 'badge rc-badge-info',
  Qualified: 'badge rc-badge-info',
};
function stageBadgeClass(value: string | null): string {
  return (value && STAGE_BADGE_CLASS[value]) || 'badge badge-neutral';
}
function distanceBadgeClass(distance: string | null): string {
  return distance === 'Long Distance' ? 'badge badge-warning' : 'badge badge-success';
}
function gapBadge(ourPrice: number | null, gapPct: number | null): { cls: string; text: string } {
  if (ourPrice == null) return { cls: 'badge badge-neutral', text: 'No Olympic price on file' };
  if (ourPrice === 0) return { cls: 'badge badge-neutral', text: 'Olympic price is R0.00 — gap n/a' };
  if (gapPct == null) return { cls: 'badge badge-neutral', text: '—' };
  if (gapPct > 0) return { cls: 'badge badge-success', text: `We're ${gapPct.toFixed(1)}% cheaper` };
  if (gapPct < 0) return { cls: 'badge rc-badge-danger', text: `We're ${Math.abs(gapPct).toFixed(1)}% pricier` };
  return { cls: 'badge badge-neutral', text: 'At parity' };
}
function chipList(items: string[], max = 4): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} +${items.length - max} more`;
}
// Canonical enum values first (so every real status/outcome is always
// filterable, even before any lead/visit happens to use it), then any extra
// values found in the data that predate/exceed the canonical list.
function optionsWithCanonical(canonical: readonly string[], found: (string | null)[]): string[] {
  const canonicalSet = new Set<string>(canonical);
  const extra = Array.from(new Set(found.filter((v): v is string => !!v && !canonicalSet.has(v)))).sort();
  return ['All', ...canonical, ...extra];
}

export default function ResinCrmClient({
  leads, visits, competitorPricing, competitorFootprint, fieldNotes, stats, loadErrors,
}: Props) {
  const [tab, setTab] = useState<Tab>('leads');
  const leadsFailedToLoad = loadErrors.includes('Leads');
  const visitsFailedToLoad = loadErrors.includes('Visits');
  const pricesFailedToLoad = loadErrors.includes('Competitor Prices');

  // ── Leads tab filters ──────────────────────────────────────────────────
  const [leadQuery, setLeadQuery] = useState('');
  const [leadStatus, setLeadStatus] = useState('All');
  const leadStatuses = useMemo(
    () => optionsWithCanonical(LEAD_STATUSES, leads.map((l) => l.lead_status)),
    [leads],
  );
  const filteredLeads = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadStatus !== 'All' && l.lead_status !== leadStatus) return false;
      if (!q) return true;
      return [l.company, l.contact_person, l.city, l.rep, l.lead_ref]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [leads, leadQuery, leadStatus]);

  // ── Visits tab filters ────────────────────────────────────────────────
  const [visitQuery, setVisitQuery] = useState('');
  const [visitOutcome, setVisitOutcome] = useState('All');
  const [visitRep, setVisitRep] = useState('All');
  const visitOutcomes = useMemo(
    () => optionsWithCanonical(VISIT_OUTCOMES, visits.map((v) => v.outcome)),
    [visits],
  );
  const visitReps = useMemo(
    () => ['All', ...Array.from(new Set(visits.map((v) => v.rep).filter(Boolean) as string[]))],
    [visits],
  );
  const filteredVisits = useMemo(() => {
    const q = visitQuery.trim().toLowerCase();
    return visits.filter((v) => {
      if (visitOutcome !== 'All' && v.outcome !== visitOutcome) return false;
      if (visitRep !== 'All' && v.rep !== visitRep) return false;
      if (!q) return true;
      return [v.company, v.rep, v.notes, v.visit_ref]
        .filter(Boolean)
        .some((val) => (val as string).toLowerCase().includes(q));
    });
  }, [visits, visitQuery, visitOutcome, visitRep]);

  return (
    <div className="rc">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="page-heading">
        <h1>Resin CRM</h1>
        <p>Leads loaded, visits logged, and competitive intelligence gathered by reps in the field.</p>
      </div>

      {loadErrors.length > 0 && (
        <div className="rc-load-err">Failed to load: {loadErrors.join(', ')} — the sections below may be incomplete or stale, not necessarily empty.</div>
      )}

      <div className="rc-tabs" role="tablist">
        <button type="button" role="tab" className={`rc-tab${tab === 'leads' ? ' is-active' : ''}`} onClick={() => setTab('leads')}>
          Leads Loaded <span className="rc-tab-count">{leads.length}</span>
        </button>
        <button type="button" role="tab" className={`rc-tab${tab === 'visits' ? ' is-active' : ''}`} onClick={() => setTab('visits')}>
          Leads Visited <span className="rc-tab-count">{visits.length}</span>
        </button>
        <button type="button" role="tab" className={`rc-tab${tab === 'intel' ? ' is-active' : ''}`} onClick={() => setTab('intel')}>
          Assessment &amp; Intel
        </button>
      </div>

      {/* ── LEADS LOADED ── */}
      {tab === 'leads' && (
        <div className="card rc-panel">
          <div className="toolbar">
            <span className="toolbar-left">{filteredLeads.length} of {leads.length} leads</span>
            <div className="rc-filters">
              <input className="rc-input" placeholder="Search company, contact, city, rep…"
                value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} />
              <select className="rc-input" value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)}>
                {leadStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {filteredLeads.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{leadsFailedToLoad ? '⚠️' : '📋'}</div>
              <div className="empty-state-title">{leadsFailedToLoad ? "Couldn't load leads" : 'No leads match'}</div>
              <div className="empty-state-body">
                {leadsFailedToLoad ? 'The leads fetch failed — try refreshing the page.' : 'Try clearing the search or status filter.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Company</th><th>Contact</th><th>Status</th><th>Distance</th>
                    <th>Location</th><th>Rep</th><th>Source</th><th>Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.company}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.lead_ref}</div>
                      </td>
                      <td>
                        {l.contact_person ?? '—'}
                        {(l.phone || l.mobile) && (
                          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{l.mobile || l.phone}</div>
                        )}
                      </td>
                      <td><span className={stageBadgeClass(l.lead_status)}>{l.lead_status ?? 'New'}</span></td>
                      <td><span className={distanceBadgeClass(l.distance)}>{l.distance}</span></td>
                      <td>{[l.city, l.province].filter(Boolean).join(', ') || '—'}</td>
                      <td>{l.rep ?? '—'}</td>
                      <td>{l.lead_source ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LEADS VISITED ── */}
      {tab === 'visits' && (
        <div className="card rc-panel">
          <div className="toolbar">
            <span className="toolbar-left">{filteredVisits.length} of {visits.length} visits</span>
            <div className="rc-filters">
              <input className="rc-input" placeholder="Search company, rep, notes…"
                value={visitQuery} onChange={(e) => setVisitQuery(e.target.value)} />
              <select className="rc-input" value={visitRep} onChange={(e) => setVisitRep(e.target.value)}>
                {visitReps.map((r) => <option key={r} value={r}>{r === 'All' ? 'All reps' : r}</option>)}
              </select>
              <select className="rc-input" value={visitOutcome} onChange={(e) => setVisitOutcome(e.target.value)}>
                {visitOutcomes.map((o) => <option key={o} value={o}>{o === 'All' ? 'All outcomes' : o}</option>)}
              </select>
            </div>
          </div>
          {filteredVisits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{visitsFailedToLoad ? '⚠️' : '🚗'}</div>
              <div className="empty-state-title">{visitsFailedToLoad ? "Couldn't load visits" : 'No visits match'}</div>
              <div className="empty-state-body">
                {visitsFailedToLoad ? 'The visits fetch failed — try refreshing the page.' : 'Try clearing the search or filters.'}
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Visit Date</th><th>Company</th><th>Rep</th><th>Outcome</th>
                    <th>Products</th><th style={{ textAlign: 'right' }}>Est. Value</th><th>Next Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map((v) => (
                    <tr key={v.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(v.visit_date)}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{v.company}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{v.visit_ref}</div>
                      </td>
                      <td>{v.rep ?? '—'}</td>
                      <td><span className={stageBadgeClass(v.outcome)}>{v.outcome ?? '—'}</span></td>
                      <td>{v.products?.length ?? 0}</td>
                      <td style={{ textAlign: 'right' }}>{fmtR(v.total)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(v.next_follow_up)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ASSESSMENT / INTELLIGENCE ── */}
      {tab === 'intel' && (
        <>
          <div className="rc-stats">
            <div className="rc-stat"><span className="rc-stat-num">{stats.totalLeads}</span><span className="rc-stat-label">Leads Loaded</span></div>
            <div className="rc-stat"><span className="rc-stat-num">{stats.totalVisits}</span><span className="rc-stat-label">Visits Logged</span></div>
            <div className="rc-stat"><span className="rc-stat-num">{stats.competitorsTracked}</span><span className="rc-stat-label">Competitors Tracked</span></div>
            <div className="rc-stat"><span className="rc-stat-num">{stats.pricePointsCaptured}</span><span className="rc-stat-label">Price Points Captured</span></div>
          </div>

          <div className="card rc-panel">
            <div className="rc-section-title">Competitor Pricing</div>
            <p className="rc-section-sub">What competitors are charging, per product, compared to Olympic&apos;s own list price — built from &quot;Current Supplier&quot; entries reps capture on Log Visit.</p>
            {competitorPricing.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{pricesFailedToLoad ? '⚠️' : '💰'}</div>
                <div className="empty-state-title">{pricesFailedToLoad ? "Couldn't load competitor prices" : 'No competitor prices captured yet'}</div>
                <div className="empty-state-body">
                  {pricesFailedToLoad
                    ? 'The competitor-price fetch failed — try refreshing the page.'
                    : 'These appear once reps log a "Current Supplier" and price on a visit.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Competitor</th><th>Product</th><th>Distance</th><th style={{ textAlign: 'right' }}>Olympic Price</th>
                      <th style={{ textAlign: 'right' }}>Their Last</th><th style={{ textAlign: 'right' }}>Their Avg (Min–Max)</th>
                      <th>Price Gap</th><th style={{ textAlign: 'right' }}>Samples</th><th>Last Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorPricing.map((r) => {
                      const gap = gapBadge(r.ourPrice, r.gapPct);
                      return (
                        <tr key={`${r.supplier}|${r.product}|${r.distance}`}>
                          <td style={{ fontWeight: 600 }}>{r.supplier}</td>
                          <td>{r.product}</td>
                          <td><span className={distanceBadgeClass(r.distance)}>{r.distance ?? 'Unknown'}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            {fmtR(r.ourPrice)}
                            {r.ourProductActive === false && (
                              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Discontinued</div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>{fmtR(r.last)}</td>
                          <td style={{ textAlign: 'right' }}>{fmtR(r.avg)} ({fmtR(r.min)}–{fmtR(r.max)})</td>
                          <td><span className={gap.cls}>{gap.text}</span></td>
                          <td style={{ textAlign: 'right' }}>{r.count}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.lastAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card rc-panel">
            <div className="rc-section-title">Competitor Footprint</div>
            <p className="rc-section-sub">Which companies each competitor is currently servicing, based on visits where a rep recorded who supplies that prospect today.</p>
            {competitorFootprint.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{pricesFailedToLoad ? '⚠️' : '🗺️'}</div>
                <div className="empty-state-title">{pricesFailedToLoad ? "Couldn't load competitor intel" : 'No competitor footprint yet'}</div>
                <div className="empty-state-body">
                  {pricesFailedToLoad
                    ? 'The competitor-price fetch failed — try refreshing the page.'
                    : 'This builds up as reps capture current suppliers during visits.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Competitor</th><th style={{ textAlign: 'right' }}>Companies Serviced</th>
                      <th>Companies</th><th>Products Seen</th><th>Last Intel Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitorFootprint.map((r) => (
                      <tr key={r.supplier}>
                        <td style={{ fontWeight: 600 }}>{r.supplier}</td>
                        <td style={{ textAlign: 'right' }}>{r.leadCount}</td>
                        <td>{chipList(r.companies)}</td>
                        <td>{chipList(r.products)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.lastCapturedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card rc-panel">
            <div className="rc-section-title">Recent Field Notes</div>
            <p className="rc-section-sub">The latest visit notes from reps, most recent first.</p>
            {fieldNotes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{visitsFailedToLoad ? '⚠️' : '📝'}</div>
                <div className="empty-state-title">{visitsFailedToLoad ? "Couldn't load field notes" : 'No field notes yet'}</div>
                <div className="empty-state-body">
                  {visitsFailedToLoad ? 'The visits fetch failed — try refreshing the page.' : 'Notes typed on Log Visit will show up here.'}
                </div>
              </div>
            ) : (
              <div className="rc-notes">
                {fieldNotes.map((n) => (
                  <div key={n.visitId} className="rc-note">
                    <div className="rc-note-head">
                      <span className="rc-note-company">{n.company}</span>
                      <span className={stageBadgeClass(n.outcome)}>{n.outcome ?? '—'}</span>
                      <span className="rc-note-meta">{n.rep ?? 'Unknown rep'} · {fmtDate(n.visitDate)}</span>
                    </div>
                    <p className="rc-note-body">{n.notes}</p>
                    {n.competitorMentions.length > 0 && (
                      <ul className="rc-note-mentions">
                        {n.competitorMentions.map((m, i) => (
                          <li key={i}>
                            Currently buying <strong>{m.name}</strong> from <strong>{m.current_supplier}</strong>
                            {m.current_supplier_price != null && <> at {fmtR(m.current_supplier_price)}</>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const css = `
  .rc-load-err {
    background: var(--color-danger-bg); color: var(--color-danger-fg); border: 1px solid var(--color-danger-bd);
    border-radius: var(--r-md); padding: 10px 14px; font-size: 13px; margin-bottom: 18px;
  }
  .rc-tabs { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--color-border-default); }
  .rc-tab {
    background: transparent; border: 0; border-bottom: 2px solid transparent; cursor: pointer;
    padding: 10px 4px; margin-right: 22px;
    font-family: var(--font-display); font-weight: 700; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase;
    color: var(--color-text-tertiary); display: flex; align-items: center; gap: 8px;
  }
  .rc-tab:hover { color: var(--color-text-primary); }
  .rc-tab.is-active { color: var(--color-brand-primary); border-bottom-color: var(--color-brand-primary); }
  .rc-tab-count {
    background: var(--color-surface-overlay); color: var(--color-text-secondary); font-size: 11px; font-weight: 700;
    padding: 1px 8px; border-radius: var(--r-pill);
  }

  .rc-panel { padding: 18px; margin-bottom: 20px; }
  .rc-filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .rc-input {
    background: var(--color-surface-sunken); border: 1px solid var(--color-border-default); color: var(--color-text-primary);
    border-radius: var(--r-md); padding: 7px 11px; font-family: var(--font-body); font-size: 13px;
  }

  .rc-section-title {
    font-family: var(--font-display); font-weight: 800; font-size: 16px; text-transform: uppercase;
    letter-spacing: 0.03em; color: var(--color-text-primary); margin-bottom: 4px;
  }
  .rc-section-sub { font-size: 12px; color: var(--color-text-tertiary); margin-bottom: 14px; max-width: 720px; }

  .rc-stats {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px;
  }
  .rc-stat {
    background: var(--color-surface-base); border: 1px solid var(--color-border-default); border-radius: var(--r-xl);
    box-shadow: var(--shadow-sm); padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;
  }
  .rc-stat-num { font-family: var(--font-display); font-weight: 900; font-size: 32px; color: var(--color-brand-primary); line-height: 1; }
  .rc-stat-label { font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-tertiary); }

  .rc-badge-danger { background: var(--color-danger-bg); color: var(--color-danger-fg); border-color: var(--color-danger-bd); }
  .rc-badge-info { background: var(--color-info-bg); color: var(--color-info-fg); border-color: var(--color-info-bd); }

  .rc-notes { display: flex; flex-direction: column; gap: 12px; }
  .rc-note { background: var(--color-surface-sunken); border: 1px solid var(--color-border-subtle); border-radius: var(--r-md); padding: 12px 14px; }
  .rc-note-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .rc-note-company { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--color-text-primary); }
  .rc-note-meta { font-size: 11px; color: var(--color-text-tertiary); margin-left: auto; }
  .rc-note-body { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; white-space: pre-wrap; }
  .rc-note-mentions { list-style: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-border-subtle); display: flex; flex-direction: column; gap: 3px; }
  .rc-note-mentions li { font-size: 12px; color: var(--color-text-tertiary); }
  .rc-note-mentions strong { color: var(--color-text-secondary); }

  @media (max-width: 768px) {
    .rc-tabs { overflow-x: auto; }
    .rc-tab { margin-right: 14px; white-space: nowrap; }
    .rc-filters { width: 100%; }
    .rc-input { flex: 1; min-width: 120px; }
  }
`;
