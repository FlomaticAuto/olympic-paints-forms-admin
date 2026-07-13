import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import EstimateForm from '../EstimateForm';
import { createEstimate } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New Resin Estimate — Olympic Resins' };

export default function NewEstimatePage() {
  return (
    <AdminShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 24px 56px' }}>
        <Link href="/admin/resin-estimates" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textDecoration: 'none' }}>← All estimates</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '30px', textTransform: 'uppercase', margin: '6px 0 20px' }}>New Estimate</h1>
        <EstimateForm action={createEstimate} />
      </div>
    </AdminShell>
  );
}
