'use client';
import { useState, useMemo } from 'react';
import type { ReturnRow } from './page';

interface Props {
  rows:  ReturnRow[];
  error: string | null;
}

type Theme = 'theme-dark' | 'theme-light' | 'theme-max';

const RETURN_TYPE_COLOURS: Record<string, string> = {
  'Rework':      '#2D8C7A',
  'Inventory':   '#2D6BA8',
  'Inv+Rework':  '#9B7DBF',
  'Written Off': '#E86060',
};

function formatDate(iso: string) {
  if (!iso || iso === '—') return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReturnsManagerClient({ rows, error }: Props) {
  const [theme, setTheme] = useState<Theme>('theme-dark');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSupervisor, setFilterSupervisor] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const returnTypes  = useMemo(() => [...new Set(rows.map(r => r.return_type).filter(v => v && v !== '—'))].sort(), [rows]);
  const supervisors  = useMemo(() => [...new Set(rows.map(r => r.supervisor).filter(v => v && v !== '—'))].sort(), [rows]);
  const categories   = useMemo(() => [...new Set(rows.map(r => r.category).filter(v => v && v !== '—'))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      if (filterType && r.return_type !== filterType) return false;
      if (filterSupervisor && r.supervisor !== filterSupervisor) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      if (q && ![r.report_ref, r.product, r.colour, r.batch_no, r.supervisor, r.notes]
        .some(v => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, search, filterType, filterSupervisor, filterCategory]);

  // KPI totals from filtered rows
  const totalQty = filtered.reduce((sum, r) => sum + (parseInt(r.qty) || 0), 0);
  const byType   = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of filtered) m[r.return_type] = (m[r.return_type] ?? 0) + 1;
    return m;
  }, [filtered]);

  return (
    <div className={`rm-wrap ${theme}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Header */}
      <header className="rm-header">
        <div className="rm-logo-wrap">
          <img src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg" alt="Olympic Paints" width={36} height={36} />
        </div>
        <div className="rm-title-block">
          <div className="rm-eyebrow">Olympic Paints</div>
          <h1>Returns Manager</h1>
        </div>
        <div className="rm-header-right">
          <a href="/returns-intake" className="rm-link-btn">+ New Return</a>
          <div className="rm-theme-toggle">
            {(['theme-dark', 'theme-light', 'theme-max'] as Theme[]).map(t => (
              <button
                key={t}
                type="button"
                className={`rm-theme-btn ${theme === t ? 'is-active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {t === 'theme-dark' ? 'Dark' : t === 'theme-light' ? 'Light' : 'Max'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="rm-error-bar">Failed to load returns: {error}</div>
      )}

      {/* KPI row */}
      <div className="rm-kpi-row">
        <div className="rm-kpi-card">
          <div className="rm-kpi-num">{filtered.length}</div>
          <div className="rm-kpi-label">Returns {search || filterType || filterSupervisor || filterCategory ? '(filtered)' : 'Total'}</div>
        </div>
        <div className="rm-kpi-card">
          <div className="rm-kpi-num">{totalQty}</div>
          <div className="rm-kpi-label">Units</div>
        </div>
        {returnTypes.map(t => (
          <div key={t} className="rm-kpi-card rm-kpi-card--sm">
            <div className="rm-kpi-num rm-kpi-num--sm" style={{ color: RETURN_TYPE_COLOURS[t] ?? 'var(--rm-yellow)' }}>
              {byType[t] ?? 0}
            </div>
            <div className="rm-kpi-label">{t}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rm-filters">
        <input
          className="rm-search"
          type="search"
          placeholder="Search ref, product, colour, batch, notes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="rm-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="rm-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All return types</option>
          {returnTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="rm-select" value={filterSupervisor} onChange={e => setFilterSupervisor(e.target.value)}>
          <option value="">All supervisors</option>
          {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || filterType || filterSupervisor || filterCategory) && (
          <button
            className="rm-clear-btn"
            onClick={() => { setSearch(''); setFilterType(''); setFilterSupervisor(''); setFilterCategory(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rm-table-wrap">
        {filtered.length === 0 ? (
          <div className="rm-empty">No returns found{search || filterType || filterSupervisor || filterCategory ? ' matching filters' : ''}.</div>
        ) : (
          <table className="rm-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Date</th>
                <th>Category</th>
                <th>Product</th>
                <th>Colour</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Return Type</th>
                <th>Batch No</th>
                <th>Supervisor</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? 'rm-row-even' : ''}>
                  <td><span className="rm-ref">{r.report_ref}</span></td>
                  <td className="rm-date">{formatDate(r.date)}</td>
                  <td>{r.category}</td>
                  <td className="rm-product">{r.product}</td>
                  <td>{r.colour}</td>
                  <td><span className="rm-size">{r.size}</span></td>
                  <td className="rm-qty">{r.qty}</td>
                  <td>
                    <span
                      className="rm-badge"
                      style={{ borderColor: RETURN_TYPE_COLOURS[r.return_type] ?? 'transparent', color: RETURN_TYPE_COLOURS[r.return_type] ?? 'inherit' }}
                    >
                      {r.return_type}
                    </span>
                  </td>
                  <td className="rm-batch">{r.batch_no}</td>
                  <td>{r.supervisor}</td>
                  <td className="rm-notes">{r.notes || <span className="rm-dim">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rm-footer">
        Showing {filtered.length} of {rows.length} return{rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

const css = `
  /* ── Tokens ── */
  .rm-wrap.theme-dark {
    --rm-page: #0D2040;
    --rm-pane: #1A3D6E;
    --rm-sunken: #071022;
    --rm-yellow: #F5C400;
    --rm-text: #FFFFFF;
    --rm-text-muted: #B8CCE8;
    --rm-text-dim: #6B9ED0;
    --rm-border: rgba(107,158,208,0.30);
    --rm-border-soft: rgba(107,158,208,0.15);
    --rm-danger-bg: rgba(232,96,96,0.14);
    --rm-danger-fg: #FDDCDC;
    --rm-danger-bd: rgba(232,96,96,0.35);
    --rm-input-bg: #071022;
    --rm-row-alt: rgba(255,255,255,0.03);
    --rm-focus: #F5C400;
  }
  .rm-wrap.theme-light {
    --rm-page: #F7F6F3;
    --rm-pane: #FFFFFF;
    --rm-sunken: #EEECEA;
    --rm-yellow: #D4A800;
    --rm-text: #0A0A08;
    --rm-text-muted: #3D3D3A;
    --rm-text-dim: #5C5B58;
    --rm-border: #C8C7C0;
    --rm-border-soft: #E0DFDA;
    --rm-danger-bg: #FCE8EC;
    --rm-danger-fg: #B00020;
    --rm-danger-bd: #B00020;
    --rm-input-bg: #FFFFFF;
    --rm-row-alt: rgba(0,0,0,0.03);
    --rm-focus: #0046B8;
  }
  .rm-wrap.theme-max {
    --rm-page: #F5C400;
    --rm-pane: #FFFFFF;
    --rm-sunken: #FAE04D;
    --rm-yellow: #000000;
    --rm-text: #000000;
    --rm-text-muted: #2E2E2C;
    --rm-text-dim: #5C5B58;
    --rm-border: #000000;
    --rm-border-soft: #5C5B58;
    --rm-danger-bg: #FFFFFF;
    --rm-danger-fg: #B00020;
    --rm-danger-bd: #B00020;
    --rm-input-bg: #FFFFFF;
    --rm-row-alt: rgba(0,0,0,0.04);
    --rm-focus: #0046B8;
  }

  /* ── Layout ── */
  .rm-wrap {
    background: var(--rm-page);
    min-height: 100vh;
    font-family: 'Barlow', sans-serif;
    color: var(--rm-text);
    padding: 12px;
    box-sizing: border-box;
  }

  /* ── Header ── */
  .rm-header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--rm-pane);
    border-radius: 10px;
    padding: 10px 16px;
    margin-bottom: 10px;
  }
  .rm-logo-wrap {
    width: 36px; height: 36px;
    border-radius: 50%; overflow: hidden; flex-shrink: 0;
  }
  .rm-logo-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .rm-title-block { line-height: 1; }
  .rm-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--rm-text-dim);
  }
  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 22px;
    text-transform: uppercase;
    color: var(--rm-yellow);
    margin: 2px 0 0; line-height: 1;
  }
  .rm-header-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .rm-link-btn {
    background: var(--rm-yellow);
    color: var(--rm-page);
    border: 0; border-radius: 8px;
    padding: 8px 16px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.06em;
    cursor: pointer; text-decoration: none;
    white-space: nowrap;
    display: inline-flex; align-items: center;
  }
  .rm-link-btn:hover { opacity: 0.85; }
  .rm-theme-toggle { display: flex; gap: 3px; background: var(--rm-sunken); border-radius: 8px; padding: 3px; }
  .rm-theme-btn {
    background: transparent; color: var(--rm-text-muted);
    border: 0; border-radius: 6px;
    padding: 6px 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 12px;
    text-transform: uppercase; letter-spacing: 0.06em;
    cursor: pointer;
  }
  .rm-theme-btn:hover { background: var(--rm-pane); }
  .rm-theme-btn.is-active { background: var(--rm-yellow); color: var(--rm-page); font-weight: 900; }

  /* ── Error bar ── */
  .rm-error-bar {
    background: var(--rm-danger-bg);
    border: 1px solid var(--rm-danger-bd);
    color: var(--rm-danger-fg);
    border-radius: 8px; padding: 12px 16px;
    font-size: 13px; margin-bottom: 10px;
  }

  /* ── KPI row ── */
  .rm-kpi-row {
    display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .rm-kpi-card {
    background: var(--rm-pane);
    border-radius: 10px; padding: 14px 20px;
    min-width: 110px; flex: 1;
  }
  .rm-kpi-card--sm { flex: 0 0 auto; min-width: 90px; }
  .rm-kpi-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 36px;
    color: var(--rm-yellow); line-height: 1;
  }
  .rm-kpi-num--sm { font-size: 28px; }
  .rm-kpi-label {
    font-family: 'Barlow', sans-serif;
    font-weight: 500; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--rm-text-muted); margin-top: 4px;
  }

  /* ── Filters ── */
  .rm-filters {
    display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; align-items: center;
  }
  .rm-search {
    flex: 1; min-width: 200px;
    background: var(--rm-input-bg);
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    border-radius: 8px; padding: 9px 12px;
    font-family: 'Barlow', sans-serif; font-size: 14px;
    box-sizing: border-box;
  }
  .rm-search:focus { outline: 3px solid var(--rm-focus); outline-offset: 2px; }
  .rm-select {
    background: var(--rm-input-bg);
    border: 1px solid var(--rm-border);
    color: var(--rm-text);
    border-radius: 8px; padding: 9px 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 13px;
    text-transform: uppercase; cursor: pointer;
    appearance: none; -webkit-appearance: none;
  }
  .rm-select:focus { outline: 3px solid var(--rm-focus); outline-offset: 2px; }
  .rm-clear-btn {
    background: transparent;
    border: 1px solid var(--rm-border);
    color: var(--rm-text-dim);
    border-radius: 8px; padding: 9px 14px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 12px;
    text-transform: uppercase; cursor: pointer;
  }
  .rm-clear-btn:hover { background: var(--rm-pane); }

  /* ── Table ── */
  .rm-table-wrap {
    background: var(--rm-pane);
    border-radius: 10px;
    overflow: auto;
    max-height: calc(100vh - 280px);
  }
  .rm-table {
    width: 100%; border-collapse: collapse;
    font-size: 13px;
  }
  .rm-table thead { position: sticky; top: 0; z-index: 1; }
  .rm-table th {
    background: var(--rm-sunken);
    padding: 10px 12px;
    text-align: left;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--rm-text-muted);
    border-bottom: 1px solid var(--rm-border);
    white-space: nowrap;
  }
  .rm-table td {
    padding: 9px 12px;
    border-bottom: 1px solid var(--rm-border-soft);
    vertical-align: top;
  }
  .rm-row-even td { background: var(--rm-row-alt); }

  .rm-ref {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 12px;
    letter-spacing: 0.04em;
    color: var(--rm-yellow);
    white-space: nowrap;
  }
  .rm-date { white-space: nowrap; color: var(--rm-text-muted); }
  .rm-product { font-weight: 500; }
  .rm-size {
    background: var(--rm-sunken);
    border-radius: 4px; padding: 2px 7px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800; font-size: 12px;
    white-space: nowrap;
  }
  .rm-qty {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900; font-size: 15px;
    text-align: center;
    color: var(--rm-yellow);
  }
  .rm-badge {
    display: inline-block;
    border: 1px solid; border-radius: 4px;
    padding: 2px 8px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em;
    white-space: nowrap;
    background: rgba(0,0,0,0.08);
  }
  .rm-batch {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px; color: var(--rm-text-muted);
  }
  .rm-notes { color: var(--rm-text-muted); font-size: 12px; max-width: 220px; }
  .rm-dim { color: var(--rm-text-dim); }

  /* ── Empty state ── */
  .rm-empty {
    text-align: center; padding: 48px 24px;
    color: var(--rm-text-dim); font-size: 14px;
  }

  /* ── Footer ── */
  .rm-footer {
    text-align: right; margin-top: 8px;
    font-size: 12px; color: var(--rm-text-dim);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .rm-header { flex-wrap: wrap; }
    .rm-header-right { width: 100%; margin-left: 0; }
    .rm-kpi-card { min-width: 80px; }
    .rm-table-wrap { max-height: none; }
  }
`;
