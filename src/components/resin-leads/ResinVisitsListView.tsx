'use client';
import { useEffect, useMemo, useState } from 'react';
import { VISIT_OUTCOMES, type ResinLeadVisit } from '@/lib/resinCrm/types';
import { fmtR, fmtDate, stagePillClass } from '@/lib/resinCrm/format';

export default function ResinVisitsListView() {
  const [visits, setVisits] = useState<ResinLeadVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState('All');
  const [rep, setRep] = useState('All');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/resin-leads/visit')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVisits(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
        <div className="rl-items">
          {filtered.map((v) => (
            <div key={v.id} className="rl-lead-card">
              <div className="rl-lead-card-top">
                <span className="rl-lead-company">{v.company}</span>
                <span className={stagePillClass(v.outcome)}>{v.outcome ?? '—'}</span>
              </div>
              <div className="rl-lead-grid">
                <div><span className="rl-lc-l">Visit Date</span><span className="rl-lc-v">{fmtDate(v.visit_date)}</span></div>
                {v.rep && <div><span className="rl-lc-l">Rep</span><span className="rl-lc-v">{v.rep}</span></div>}
                <div><span className="rl-lc-l">Products</span><span className="rl-lc-v">{v.products?.length ?? 0}</span></div>
                {v.next_follow_up && <div><span className="rl-lc-l">Next Follow-up</span><span className="rl-lc-v">{fmtDate(v.next_follow_up)}</span></div>}
              </div>
              <div className="rl-grand">
                <span className="rl-grand-l">Est. Value</span>
                <span className="rl-grand-v">{fmtR(v.total)}</span>
              </div>
              {v.notes && <p className="rl-hint">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
