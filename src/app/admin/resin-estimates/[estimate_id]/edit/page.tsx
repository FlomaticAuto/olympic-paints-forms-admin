import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import EstimateForm from '../../EstimateForm';
import { updateEstimate } from '../../actions';
import { createServerClient } from '@/lib/supabase/server';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Resin Estimate — Olympic Resins' };

export default async function EditEstimatePage({ params }: { params: Promise<{ estimate_id: string }> }) {
  const { estimate_id } = await params;
  const db = createServerClient();
  const { data: est } = await db.from('resin_estimates').select('*').eq('id', estimate_id).maybeSingle();
  if (!est) notFound();
  const { data: lines } = await db.from('resin_estimate_lines').select('*').eq('estimate_id', estimate_id).order('sort_order');

  const estimate = est as unknown as ResinEstimate;
  const bound = updateEstimate.bind(null, estimate_id);

  return (
    <AdminShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px 56px' }}>
        <Link href={`/admin/resin-estimates/${estimate_id}`} style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>← Back to estimate</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '30px', textTransform: 'uppercase', margin: '6px 0 20px' }}>Edit {estimate.estimate_number}</h1>
        <EstimateForm action={bound} estimate={estimate} existingLines={(lines ?? []) as unknown as ResinEstimateLine[]} />
      </div>
    </AdminShell>
  );
}
