// Auto-generates the next estimate number in the form RES-EST-YYYY-NNN.
// Per calendar year, zero-padded to 3 digits, resilient to gaps (max+1).

import type { createServerClient } from '@/lib/supabase/server';

type Db = ReturnType<typeof createServerClient>;

export function estimatePrefix(year = new Date().getFullYear()): string {
  return `RES-EST-${year}-`;
}

export async function nextEstimateNumber(db: Db): Promise<string> {
  const prefix = estimatePrefix();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (db.from('resin_estimates') as any)
    .select('estimate_number')
    .ilike('estimate_number', `${prefix}%`);

  let max = 0;
  for (const row of (data ?? []) as Array<{ estimate_number: string }>) {
    const tail = String(row.estimate_number).slice(prefix.length);
    const n = parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
