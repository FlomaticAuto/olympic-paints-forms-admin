import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import SendButton from './SendButton';
import { createServerClient } from '@/lib/supabase/server';
import { buildDefaultBody } from '@/lib/resinEstimates/emailBody';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';

export const dynamic = 'force-dynamic';

const money = (n: number) =>
  'R ' + (Number(n) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function EstimateViewPage({ params }: { params: Promise<{ estimate_id: string }> }) {
  const { estimate_id } = await params;
  const db = createServerClient();
  const { data: estRaw } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!estRaw) notFound();
  const est = estRaw as unknown as ResinEstimate;

  const { data: linesRaw } = await db.from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');
  const lines = (linesRaw ?? []) as unknown as ResinEstimateLine[];

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  const { subject, bodyText } = buildDefaultBody(est, { total });

  return (
    <AdminShell>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 24px 56px' }}>
        <Link href="/admin/resin-estimates" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>← All estimates</Link>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', margin: '6px 0 20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '30px', textTransform: 'uppercase', margin: 0 }}>{est.estimate_number}</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: '2px 0 0' }}>
              {est.client}{est.contact_name ? ` · ${est.contact_name}` : ''} · <span style={{ textTransform: 'capitalize' }}>{est.status}</span>
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link href={`/admin/resin-estimates/${est.id}/edit`} style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--r-pill)', padding: '9px 18px', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>Edit</Link>
            <SendButton estimateId={est.id} defaultSubject={subject} defaultBody={bodyText} />
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px', marginBottom: '20px' }}>
          <Meta label="Date issued" value={est.date_issued} />
          <Meta label="Valid until" value={est.valid_until ?? '30 days'} />
          <Meta label="Price basis" value={est.price_basis === 'long' ? 'Long distance' : 'Local (list)'} />
          <Meta label="Prepared by" value={est.prepared_by ?? 'Kim Williams'} />
          {est.contact_email && <Meta label="Contact email" value={est.contact_email} />}
          {est.contact_phone && <Meta label="Contact phone" value={est.contact_phone} />}
        </div>

        {/* Lines */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--r-xl)', background: 'var(--color-surface-base)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '560px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Unit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Unit price</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.id}>
                  <td style={tdStyle}>{l.description}{l.product_code ? <span style={{ color: 'var(--color-text-tertiary)' }}> · {l.product_code}</span> : null}{l.category ? <span style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}> ({l.category})</span> : null}</td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{l.unit ?? 'kg'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{l.qty}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{money(l.unit_price)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{money(l.unit_price * l.qty)}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No line items — <Link href={`/admin/resin-estimates/${est.id}/edit`}>add products</Link>.</td></tr>
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>Subtotal (excl. VAT)</td><td style={{ ...tdStyle, textAlign: 'right' }}>{money(subtotal)}</td></tr>
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-text-secondary)' }}>VAT @ 15%</td><td style={{ ...tdStyle, textAlign: 'right' }}>{money(vat)}</td></tr>
                <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>Total (incl. VAT)</td><td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800 }}>{money(total)}</td></tr>
              </tfoot>
            )}
          </table>
        </div>

        {est.notes && <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}><b>Notes:</b> {est.notes}</p>}
      </div>
    </AdminShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--color-surface-base)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '14px', marginTop: '2px' }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'left',
  color: 'var(--color-text-secondary)', padding: '10px 12px', borderBottom: '2px solid var(--color-border-default)', whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid var(--color-border-subtle)' };
