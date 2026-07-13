import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { createServerClient } from '@/lib/supabase/server';
import type { ResinEstimate } from '@/lib/resinEstimates/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resin Estimates — Olympic Resins' };

const money = (n: number) =>
  'R ' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  draft:    { bg: 'var(--color-neutral-bg)', fg: 'var(--color-neutral-fg)' },
  sent:     { bg: 'var(--color-info-bg)', fg: 'var(--color-info-fg)' },
  approved: { bg: 'var(--color-success-bg)', fg: 'var(--color-success-fg)' },
  declined: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger-fg)' },
};

export default async function ResinEstimatesPage() {
  const db = createServerClient();
  const { data } = await db
    .from('resin_estimates')
    .select('id, estimate_number, client, contact_name, date_issued, status, price_basis')
    .order('created_at', { ascending: false });

  // pull line totals in one query and reduce per estimate
  const { data: lineRows } = await db
    .from('resin_estimate_lines')
    .select('estimate_id, line_total');
  const totalByEst = new Map<string, number>();
  for (const r of (lineRows ?? []) as { estimate_id: string; line_total: number }[]) {
    totalByEst.set(r.estimate_id, (totalByEst.get(r.estimate_id) ?? 0) + Number(r.line_total || 0));
  }

  const estimates = (data ?? []) as Pick<ResinEstimate,
    'id' | 'estimate_number' | 'client' | 'contact_name' | 'date_issued' | 'status' | 'price_basis'>[];

  return (
    <AdminShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px 56px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '30px', textTransform: 'uppercase', margin: 0 }}>Resin Estimates</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: '2px 0 0' }}>
              Build a product quote, generate the branded PDF, and email it to Kim.
            </p>
          </div>
          <Link href="/admin/resin-estimates/new" style={{
            marginLeft: 'auto', background: 'var(--color-brand-primary)', color: '#0D0D0B', textDecoration: 'none',
            borderRadius: 'var(--r-pill)', padding: '10px 20px', fontWeight: 700, fontSize: '14px',
          }}>+ New estimate</Link>
        </div>

        {estimates.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-default)', borderRadius: 'var(--r-xl)' }}>
            No estimates yet. Click <b>New estimate</b> to create the first one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--r-xl)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'var(--color-surface-base)' }}>
              <thead>
                <tr>
                  {['Number', 'Client', 'Date', 'Basis', 'Total (incl. VAT)', 'Status'].map((h, i) => (
                    <th key={h} style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: i >= 4 ? (i === 4 ? 'right' : 'left') : 'left', color: 'var(--color-text-secondary)', padding: '10px 14px', borderBottom: '2px solid var(--color-border-default)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimates.map(e => {
                  const total = totalByEst.get(e.id) ?? 0;
                  const withVat = total * 1.15;
                  const st = STATUS_STYLE[e.status] ?? STATUS_STYLE.draft;
                  return (
                    <tr key={e.id}>
                      <td style={tdStyle}><Link href={`/admin/resin-estimates/${e.id}`} style={{ fontWeight: 700, color: 'var(--color-text-primary)', textDecoration: 'none' }}>{e.estimate_number}</Link></td>
                      <td style={tdStyle}>{e.client}{e.contact_name ? <span style={{ color: 'var(--color-text-tertiary)' }}> · {e.contact_name}</span> : null}</td>
                      <td style={tdStyle}>{e.date_issued}</td>
                      <td style={tdStyle}>{e.price_basis === 'long' ? 'Long dist.' : 'Local'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(withVat)}</td>
                      <td style={tdStyle}><span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 'var(--r-pill)', fontSize: '11px', fontWeight: 600, background: st.bg, color: st.fg, textTransform: 'capitalize' }}>{e.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

const tdStyle: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' };
