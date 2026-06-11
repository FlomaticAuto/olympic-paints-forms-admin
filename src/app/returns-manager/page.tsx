import { createServerClient } from '@/lib/supabase/server';
import type { FormSubmission } from '@/lib/supabase/types';
import ReturnsManagerClient from './ReturnsManagerClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Returns Manager — Olympic Paints',
};

const RETURNS_FORM_ID = process.env.RETURNS_INTAKE_FORM_ID ?? 'returns-intake';

interface ReturnData {
  report_ref:  string;
  date:        string;
  category:    string;
  product:     string;
  colour:      string;
  size:        string;
  qty:         string;
  return_type: string;
  batch_no:    string;
  supervisor:  string;
  notes:       string;
}

export interface ReturnRow {
  id:          string;
  submitted_at: string;
  report_ref:  string;
  date:        string;
  category:    string;
  product:     string;
  colour:      string;
  size:        string;
  qty:         string;
  return_type: string;
  batch_no:    string;
  supervisor:  string;
  notes:       string;
}

export default async function ReturnsManagerPage() {
  const db = createServerClient();

  const { data: rawSubs, error } = await db
    .from('form_submissions')
    .select('*')
    .eq('form_id', RETURNS_FORM_ID)
    .order('submitted_at', { ascending: false });

  const submissions = (rawSubs ?? []) as FormSubmission[];

  const rows: ReturnRow[] = submissions.map((s) => {
    const d = (s.data ?? {}) as Partial<ReturnData>;
    return {
      id:           s.id,
      submitted_at: s.submitted_at,
      report_ref:   d.report_ref  ?? '—',
      date:         d.date        ?? '—',
      category:     d.category    ?? '—',
      product:      d.product     ?? '—',
      colour:       d.colour      ?? '—',
      size:         d.size        ?? '—',
      qty:          d.qty         ?? '—',
      return_type:  d.return_type ?? '—',
      batch_no:     d.batch_no    ?? '—',
      supervisor:   d.supervisor  ?? '—',
      notes:        d.notes       ?? '',
    };
  });

  return <ReturnsManagerClient rows={rows} error={error?.message ?? null} />;
}
