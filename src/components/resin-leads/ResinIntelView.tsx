'use client';
import { useEffect, useState } from 'react';
import type {
  CompetitorPriceRow,
  CompetitorFootprintRow,
  FieldNote,
  StatTiles,
} from '@/lib/resinCrm/types';
import { fmtR, fmtDate, stagePillClass, distancePillClass, chipList } from '@/lib/resinCrm/format';

interface IntelData {
  competitorPricing: CompetitorPriceRow[];
  competitorFootprint: CompetitorFootprintRow[];
  fieldNotes: FieldNote[];
  stats: StatTiles;
  loadErrors: string[];
}

function gapPill(ourPrice: number | null, gapPct: number | null): { cls: string; text: string } {
  if (ourPrice == null) return { cls: 'rl-pill rl-pill-neutral', text: 'No Olympic price on file' };
  if (ourPrice === 0) return { cls: 'rl-pill rl-pill-neutral', text: 'Olympic price is R0.00 — gap n/a' };
  if (gapPct == null) return { cls: 'rl-pill rl-pill-neutral', text: '—' };
  if (gapPct > 0) return { cls: 'rl-pill rl-pill-success', text: `We're ${gapPct.toFixed(1)}% cheaper` };
  if (gapPct < 0) return { cls: 'rl-pill rl-pill-danger', text: `We're ${Math.abs(gapPct).toFixed(1)}% pricier` };
  return { cls: 'rl-pill rl-pill-neutral', text: 'At parity' };
}

export default function ResinIntelView() {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/resin-leads/intel')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="rl-form"><div className="rl-empty"><div className="rl-empty-body">Loading…</div></div></div>;
  }
  if (failed || !data) {
    return (
      <div className="rl-form">
        <div className="rl-empty">
          <div className="rl-empty-icon">⚠️</div>
          <div className="rl-empty-title">Couldn't load the report</div>
          <div className="rl-empty-body">Try again in a moment.</div>
        </div>
      </div>
    );
  }

  const { competitorPricing, competitorFootprint, fieldNotes, stats, loadErrors } = data;
  const pricesFailed = loadErrors.includes('Competitor Prices');
  const visitsFailed = loadErrors.includes('Visits');

  return (
    <div className="rl-form">
      <div className="rl-section-title">Assessment &amp; Intel</div>

      {loadErrors.length > 0 && (
        <p className="rl-error">Failed to load: {loadErrors.join(', ')} — this report may be incomplete.</p>
      )}

      <div className="rl-stats">
        <div className="rl-stat"><span className="rl-stat-num">{stats.totalLeads}</span><span className="rl-stat-label">Leads Loaded</span></div>
        <div className="rl-stat"><span className="rl-stat-num">{stats.totalVisits}</span><span className="rl-stat-label">Visits Logged</span></div>
        <div className="rl-stat"><span className="rl-stat-num">{stats.competitorsTracked}</span><span className="rl-stat-label">Competitors</span></div>
        <div className="rl-stat"><span className="rl-stat-num">{stats.pricePointsCaptured}</span><span className="rl-stat-label">Prices Captured</span></div>
      </div>

      <div className="rl-section-title">
        Competitor Pricing
        <span className="rl-section-note">what they charge vs. our list price</span>
      </div>
      {competitorPricing.length === 0 ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">{pricesFailed ? '⚠️' : '💰'}</div>
          <div className="rl-empty-title">{pricesFailed ? "Couldn't load competitor prices" : 'No competitor prices captured yet'}</div>
          <div className="rl-empty-body">
            {pricesFailed ? 'Try again in a moment.' : 'These appear once a rep logs a "Current Supplier" and price on a visit.'}
          </div>
        </div>
      ) : (
        <div className="rl-items">
          {competitorPricing.map((r) => {
            const gap = gapPill(r.ourPrice, r.gapPct);
            return (
              <div key={`${r.supplier}|${r.product}|${r.distance}`} className="rl-compare-card">
                <div className="rl-compare-head">
                  <span className="rl-compare-supplier">{r.supplier}</span>
                  <span className={distancePillClass(r.distance)}>{r.distance ?? 'Unknown'}</span>
                </div>
                <div className="rl-compare-product">{r.product}</div>
                <div className="rl-compare-nums">
                  <span><span className="rl-compare-num-l">Us</span><span className="rl-compare-num-v">{fmtR(r.ourPrice)}</span></span>
                  <span><span className="rl-compare-num-l">Them</span><span className="rl-compare-num-v">{fmtR(r.last)}</span></span>
                </div>
                {r.ourProductActive === false && <p className="rl-compare-sub">Olympic product is discontinued</p>}
                <p className="rl-compare-sub">avg {fmtR(r.avg)} · {r.count} sample{r.count === 1 ? '' : 's'} · last seen {fmtDate(r.lastAt)}</p>
                <span className={gap.cls}>{gap.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="rl-section-title">
        Competitor Footprint
        <span className="rl-section-note">who they're servicing</span>
      </div>
      {competitorFootprint.length === 0 ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">{pricesFailed ? '⚠️' : '🗺️'}</div>
          <div className="rl-empty-title">{pricesFailed ? "Couldn't load competitor intel" : 'No competitor footprint yet'}</div>
          <div className="rl-empty-body">
            {pricesFailed ? 'Try again in a moment.' : 'This builds up as reps capture current suppliers during visits.'}
          </div>
        </div>
      ) : (
        <div className="rl-items">
          {competitorFootprint.map((r) => (
            <div key={r.supplier} className="rl-footprint-card">
              <div className="rl-footprint-head">
                <span className="rl-footprint-supplier">{r.supplier}</span>
                <span className="rl-footprint-count">{r.leadCount} compan{r.leadCount === 1 ? 'y' : 'ies'}</span>
              </div>
              <div className="rl-footprint-companies">{chipList(r.companies)}</div>
              <div className="rl-footprint-products">Products: {chipList(r.products)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rl-section-title">Recent Field Notes</div>
      {fieldNotes.length === 0 ? (
        <div className="rl-empty">
          <div className="rl-empty-icon">{visitsFailed ? '⚠️' : '📝'}</div>
          <div className="rl-empty-title">{visitsFailed ? "Couldn't load field notes" : 'No field notes yet'}</div>
          <div className="rl-empty-body">
            {visitsFailed ? 'Try again in a moment.' : 'Notes typed on Log Visit will show up here.'}
          </div>
        </div>
      ) : (
        <div className="rl-items">
          {fieldNotes.map((n) => (
            <div key={n.visitId} className="rl-note-card">
              <div className="rl-note-head">
                <span className="rl-note-company">{n.company}</span>
                <span className={stagePillClass(n.outcome)}>{n.outcome ?? '—'}</span>
                <span className="rl-note-meta">{n.rep ?? 'Unknown rep'} · {fmtDate(n.visitDate)}</span>
              </div>
              <p className="rl-note-body">{n.notes}</p>
              {n.competitorMentions.length > 0 && (
                <ul className="rl-note-mentions">
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
  );
}
