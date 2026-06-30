import { createServerClient } from '@/lib/supabase/server';
import AdminShell from '@/components/AdminShell';
import CockpitClient from './CockpitClient';
import { COCKPIT_SOURCES, type CockpitRecord } from '@/lib/cockpitSources';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Operations Cockpit — Olympic Paints',
};

export interface DeptSummary {
  key:         string;
  label:       string;
  department:  string;
  owner:       string;
  unit:        string;
  href:        string | null;
  cadence:     'weekday' | 'daily';
  filed:       boolean;
  count:       number;
  metricValue: number;
  exceptions:  string[];
  lastFiled:   string | null;
  totalRecords: number;
  error:       string | null;
}

// YYYY-MM-DD in SA time (Vercel runs UTC; the business is UTC+2).
function saDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(d);
}

// Previous working day (skips Sat/Sun) in SA time.
function prevWorkingDay(): string {
  let d = new Date();
  for (let i = 0; i < 7; i++) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const dow = new Date(saDate(d) + 'T12:00:00').getUTCDay(); // 0=Sun .. 6=Sat
    if (dow !== 0 && dow !== 6) break;
  }
  return saDate(d);
}

const asDate = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 10) : '');

export default async function CockpitPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const db = createServerClient();
  const sp = await searchParams;
  const selectedDate = sp?.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : prevWorkingDay();

  const summaries: DeptSummary[] = await Promise.all(
    COCKPIT_SOURCES.map(async (src): Promise<DeptSummary> => {
      let recs: { date: string; record: CockpitRecord }[] = [];
      let error: string | null = null;

      try {
        if (src.source.type === 'form') {
          // select('*') avoids Supabase's jsonb→never generic narrowing on column-list selects.
          const { data, error: e } = await db
            .from('form_submissions')
            .select('*')
            .eq('form_id', src.source.formId);
          if (e) throw e;
          const field = src.source.dateField;
          const rows = (data ?? []) as Array<{ data: CockpitRecord | null }>;
          recs = rows.map((r) => {
            const rec = (r.data ?? {}) as CockpitRecord;
            return { date: asDate(rec[field]), record: rec };
          });
        } else {
          const col = src.source.dateColumn;
          // dynamic table name — cast around the typed client
          const { data, error: e } = await (db as unknown as {
            from: (t: string) => { select: (s: string) => Promise<{ data: CockpitRecord[] | null; error: unknown }> };
          })
            .from(src.source.table)
            .select('*');
          if (e) throw e;
          recs = (data ?? []).map((r) => ({ date: asDate(r[col]), record: r }));
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const dayRecs = recs.filter((r) => r.date === selectedDate).map((r) => r.record);
      const dated = recs.map((r) => r.date).filter(Boolean).sort();
      const lastFiled = dated.length ? dated[dated.length - 1] : null;

      return {
        key:         src.key,
        label:       src.label,
        department:  src.department,
        owner:       src.owner,
        unit:        src.unit,
        href:        src.href ?? null,
        cadence:     src.cadence,
        filed:       dayRecs.length > 0,
        count:       dayRecs.length,
        metricValue: dayRecs.length ? src.metric(dayRecs) : 0,
        exceptions:  dayRecs.length && src.exceptions ? src.exceptions(dayRecs) : [],
        lastFiled,
        totalRecords: dated.length,
        error,
      };
    }),
  );

  return (
    <AdminShell>
      <CockpitClient summaries={summaries} selectedDate={selectedDate} />
    </AdminShell>
  );
}
