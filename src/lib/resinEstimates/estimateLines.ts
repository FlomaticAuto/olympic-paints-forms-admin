// Maps incoming estimate-line payloads to DB rows. Used by create + update so
// both compute the same thing. line_total is a generated column (qty*unit_price)
// so we do NOT set it here.
import type { RawEstimateLine } from './types';

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || null;
};

export function buildEstimateLineRows(lines: RawEstimateLine[], estimateId: string) {
  return lines
    // drop empty rows (no description and no product)
    .filter(l => (str(l.description) || str(l.product_id)))
    .map((l, idx) => ({
      estimate_id:  estimateId,
      product_id:   str(l.product_id),
      product_code: str(l.product_code),
      description:  String(l.description ?? '').trim(),
      category:     str(l.category),
      unit:         str(l.unit) ?? 'kg',
      qty:          num(l.qty),
      unit_price:   num(l.unit_price),
      sort_order:   idx,
    }));
}
