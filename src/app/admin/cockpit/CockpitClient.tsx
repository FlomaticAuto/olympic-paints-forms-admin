'use client';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { DeptSummary } from './page';

interface Props {
  summaries:    DeptSummary[];
  selectedDate: string;
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CockpitClient({ summaries, selectedDate }: Props) {
  const router = useRouter();
  const go = (date: string) => router.push(`/admin/cockpit?date=${date}`);

  const filedCount = useMemo(() => summaries.filter((s) => s.filed).length, [summaries]);
  const exceptionCount = useMemo(
    () => summaries.reduce((n, s) => n + s.exceptions.length, 0),
    [summaries],
  );

  return (
    <div className="ck">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="page-heading">
        <h1>Operations Cockpit</h1>
        <p>One screen, every department, one day. A greyed card means the report was not filed.</p>
      </div>

      {/* Day navigation + summary strip */}
      <div className="ck-toolbar">
        <div className="ck-daynav">
          <button className="ck-navbtn" onClick={() => go(shiftDay(selectedDate, -1))} aria-label="Previous day">‹</button>
          <input
            className="ck-dateinput"
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && go(e.target.value)}
          />
          <button className="ck-navbtn" onClick={() => go(shiftDay(selectedDate, 1))} aria-label="Next day">›</button>
        </div>
        <div className="ck-strip">
          <div className="ck-stat">
            <span className="ck-stat-num">{filedCount}<span className="ck-stat-den">/{summaries.length}</span></span>
            <span className="ck-stat-label">Departments filed</span>
          </div>
          <div className="ck-stat">
            <span className={`ck-stat-num ${exceptionCount ? 'is-warn' : ''}`}>{exceptionCount}</span>
            <span className="ck-stat-label">Exceptions flagged</span>
          </div>
        </div>
      </div>

      {/* Department cards */}
      <div className="ck-grid">
        {summaries.map((s) => (
          <div key={s.key} className={`ck-card ${s.filed ? '' : 'is-blank'}`}>
            <div className="ck-card-top">
              <div>
                <div className="ck-card-title">{s.label}</div>
                <div className="ck-card-dept">{s.department}</div>
              </div>
              {s.filed
                ? <span className="ck-pill is-filed">Filed</span>
                : <span className="ck-pill is-notfiled">Not filed</span>}
            </div>

            {s.error ? (
              <div className="ck-err">Load error: {s.error}</div>
            ) : s.filed ? (
              <div className="ck-metric">
                <span className="ck-metric-num">{s.metricValue}</span>
                <span className="ck-metric-unit">{s.unit}</span>
                {s.count !== s.metricValue && <span className="ck-metric-sub">across {s.count} entr{s.count === 1 ? 'y' : 'ies'}</span>}
              </div>
            ) : (
              <div className="ck-metric ck-metric--blank">
                <span className="ck-metric-num">—</span>
                <span className="ck-metric-sub">last filed {fmt(s.lastFiled)}</span>
              </div>
            )}

            {s.exceptions.length > 0 && (
              <ul className="ck-exc">
                {s.exceptions.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
                {s.exceptions.length > 4 && <li className="ck-exc-more">+{s.exceptions.length - 4} more</li>}
              </ul>
            )}

            <div className="ck-card-foot">
              <span className="ck-owner">{s.owner}</span>
              {s.href && <a className="ck-detail" href={s.href}>Details →</a>}
            </div>
          </div>
        ))}
      </div>

      <div className="ck-footer">Showing {fmt(selectedDate)} · {summaries.length} departments tracked</div>
    </div>
  );
}

const css = `
  .ck-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; margin-bottom: 22px;
  }
  .ck-daynav { display: flex; align-items: center; gap: 6px; }
  .ck-navbtn {
    background: var(--color-surface-base);
    border: 1px solid var(--color-border-default);
    color: var(--color-text-primary);
    border-radius: var(--r-md);
    width: 38px; height: 38px;
    font-size: 20px; font-weight: 700; cursor: pointer; line-height: 1;
  }
  .ck-navbtn:hover { background: var(--color-surface-overlay); border-color: var(--color-border-strong); }
  .ck-dateinput {
    background: var(--color-surface-sunken);
    border: 1px solid var(--color-border-default);
    color: var(--color-text-primary);
    border-radius: var(--r-md); padding: 8px 12px;
    font-family: var(--font-body); font-size: 14px;
    color-scheme: dark;
  }
  .ck-strip { display: flex; gap: 24px; }
  .ck-stat { display: flex; flex-direction: column; align-items: flex-end; }
  .ck-stat-num {
    font-family: var(--font-display); font-weight: 900; font-size: 30px;
    color: var(--color-brand-primary); line-height: 1;
  }
  .ck-stat-num.is-warn { color: var(--color-warning-fg); }
  .ck-stat-den { font-size: 18px; color: var(--color-text-tertiary); font-weight: 700; }
  .ck-stat-label {
    font-family: var(--font-display); font-size: 10px; font-weight: 700;
    letter-spacing: 0.10em; text-transform: uppercase;
    color: var(--color-text-tertiary); margin-top: 3px;
  }

  .ck-grid {
    display: grid; gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  }
  .ck-card {
    background: var(--color-surface-base);
    border: 1px solid var(--color-border-default);
    border-radius: var(--r-xl);
    box-shadow: var(--shadow-sm);
    padding: 18px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .ck-card.is-blank { opacity: 0.62; border-style: dashed; box-shadow: none; }

  .ck-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .ck-card-title {
    font-family: var(--font-display); font-weight: 800; font-size: 17px;
    text-transform: uppercase; letter-spacing: 0.02em; color: var(--color-text-primary); line-height: 1.1;
  }
  .ck-card-dept { font-size: 12px; color: var(--color-text-tertiary); margin-top: 3px; }

  .ck-pill {
    font-family: var(--font-display); font-size: 10px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 3px 9px; border-radius: var(--r-pill); border: 1px solid transparent; white-space: nowrap;
  }
  .ck-pill.is-filed { background: var(--color-success-bg); color: var(--color-success-fg); border-color: var(--color-success-bd); }
  .ck-pill.is-notfiled { background: var(--color-neutral-bg); color: var(--color-neutral-fg); border-color: var(--color-neutral-bd); }

  .ck-metric { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .ck-metric-num {
    font-family: var(--font-display); font-weight: 900; font-size: 44px;
    color: var(--color-brand-primary); line-height: 0.9;
  }
  .ck-metric--blank .ck-metric-num { color: var(--color-text-tertiary); }
  .ck-metric-unit {
    font-family: var(--font-display); font-weight: 700; font-size: 14px;
    text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-secondary);
  }
  .ck-metric-sub { font-size: 12px; color: var(--color-text-tertiary); }

  .ck-exc {
    list-style: none; margin: 0; padding: 10px 12px;
    background: var(--color-warning-bg); border: 1px solid var(--color-warning-bd);
    border-radius: var(--r-md);
  }
  .ck-exc li {
    font-size: 12px; color: var(--color-warning-fg); padding: 1px 0;
  }
  .ck-exc li::before { content: '⚠ '; }
  .ck-exc-more::before { content: '' !important; }
  .ck-exc-more { color: var(--color-text-tertiary) !important; font-style: italic; }

  .ck-err {
    font-size: 12px; color: var(--color-danger-fg);
    background: var(--color-danger-bg); border: 1px solid var(--color-danger-bd);
    border-radius: var(--r-md); padding: 8px 10px;
  }

  .ck-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin-top: auto; padding-top: 10px; border-top: 1px solid var(--color-border-subtle);
  }
  .ck-owner { font-size: 11px; color: var(--color-text-tertiary); }
  .ck-detail { font-size: 12px; font-weight: 600; }

  .ck-footer { margin-top: 20px; font-size: 12px; color: var(--color-text-tertiary); text-align: right; }

  @media (max-width: 768px) {
    .ck-toolbar { flex-direction: column; align-items: stretch; }
    .ck-strip { justify-content: space-between; }
    .ck-grid { grid-template-columns: 1fr; }
  }
`;
