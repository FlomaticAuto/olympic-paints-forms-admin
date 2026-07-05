'use client';
import { useEffect, useMemo, useState } from 'react';
import { LEAD_STATUSES, type ResinLead } from '@/lib/resinCrm/types';
import { fmtDate, stagePillClass, distancePillClass } from '@/lib/resinCrm/format';

export default function ResinLeadsListView() {
  const [leads, setLeads] = useState<ResinLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/resin-leads/lead')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setLeads(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

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
          {filtered.map((l) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
