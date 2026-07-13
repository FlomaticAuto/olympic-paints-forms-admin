'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { nextEstimateNumber } from '@/lib/resinEstimates/estimateNumber';
import { buildEstimateLineRows } from '@/lib/resinEstimates/estimateLines';
import type { RawEstimateLine } from '@/lib/resinEstimates/types';

// Shape posted from the estimate form (JSON string of lines + header fields).
interface EstimatePayload {
  client: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  site?: string;
  date_issued?: string;
  valid_until?: string;
  price_basis?: 'local' | 'long';
  notes?: string;
  terms?: string;
  prepared_by?: string;
  lines: RawEstimateLine[];
}

function parsePayload(fd: FormData): EstimatePayload {
  const s = (k: string) => {
    const v = fd.get(k);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  };
  let lines: RawEstimateLine[] = [];
  try { lines = JSON.parse(String(fd.get('lines') ?? '[]')); } catch { lines = []; }
  return {
    client: s('client') ?? '',
    contact_name: s('contact_name'),
    contact_email: s('contact_email'),
    contact_phone: s('contact_phone'),
    site: s('site'),
    date_issued: s('date_issued'),
    valid_until: s('valid_until'),
    price_basis: (s('price_basis') as 'local' | 'long') ?? 'local',
    notes: s('notes'),
    terms: s('terms'),
    prepared_by: s('prepared_by'),
    lines,
  };
}

export async function createEstimate(fd: FormData) {
  const p = parsePayload(fd);
  if (!p.client) throw new Error('Client is required');

  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let estimate: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastErr: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const estimate_number = await nextEstimateNumber(db);
    const { data, error } = await db
      .from('resin_estimates')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        estimate_number,
        client: p.client,
        contact_name: p.contact_name ?? null,
        contact_email: p.contact_email ?? null,
        contact_phone: p.contact_phone ?? null,
        site: p.site ?? null,
        date_issued: p.date_issued ?? undefined,
        valid_until: p.valid_until ?? null,
        price_basis: p.price_basis ?? 'local',
        notes: p.notes ?? null,
        terms: p.terms ?? null,
        prepared_by: p.prepared_by ?? 'Kim Williams',
        status: 'draft',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select()
      .single();
    if (!error) { estimate = data; break; }
    lastErr = error;
    if (error.code !== '23505') break;
  }
  if (!estimate) throw new Error(lastErr?.message ?? 'Failed to create estimate');

  if (p.lines.length) {
    const rows = buildEstimateLineRows(p.lines, estimate.id);
    if (rows.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lineErr } = await db.from('resin_estimate_lines').insert(rows as any);
      if (lineErr) throw new Error(lineErr.message);
    }
  }

  revalidatePath('/admin/resin-estimates');
  redirect(`/admin/resin-estimates/${estimate.id}`);
}

export async function updateEstimate(estimateId: string, fd: FormData) {
  const p = parsePayload(fd);
  if (!p.client) throw new Error('Client is required');

  const db = createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.from('resin_estimates') as any)
    .update({
      client: p.client,
      contact_name: p.contact_name ?? null,
      contact_email: p.contact_email ?? null,
      contact_phone: p.contact_phone ?? null,
      site: p.site ?? null,
      date_issued: p.date_issued ?? undefined,
      valid_until: p.valid_until ?? null,
      price_basis: p.price_basis ?? 'local',
      notes: p.notes ?? null,
      terms: p.terms ?? null,
      prepared_by: p.prepared_by ?? 'Kim Williams',
      updated_at: new Date().toISOString(),
    })
    .eq('id', estimateId);
  if (error) throw new Error(error.message);

  // Replace lines wholesale (simplest correct approach for an edit form).
  await db.from('resin_estimate_lines').delete().eq('estimate_id', estimateId);
  if (p.lines.length) {
    const rows = buildEstimateLineRows(p.lines, estimateId);
    if (rows.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lineErr } = await db.from('resin_estimate_lines').insert(rows as any);
      if (lineErr) throw new Error(lineErr.message);
    }
  }

  revalidatePath(`/admin/resin-estimates/${estimateId}`);
  redirect(`/admin/resin-estimates/${estimateId}`);
}

export async function setStatus(estimateId: string, status: 'draft' | 'sent' | 'approved' | 'declined') {
  const db = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('resin_estimates') as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', estimateId);
  revalidatePath(`/admin/resin-estimates/${estimateId}`);
}
