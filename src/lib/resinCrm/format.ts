// Shared display helpers for the resin-leads report views (Leads / Visits / Intel)
// so formatting and pill-color rules live in one place, not copy-pasted per view.

export function fmtR(n: number | null): string {
  return n == null ? '—' : 'R' + n.toFixed(2);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// One shared map for both lead-status and visit-outcome pills — the two
// vocabularies overlap (Won, Lost, Negotiating, Quoted) and must agree.
const STAGE_PILL_CLASS: Record<string, string> = {
  Won: 'rl-pill rl-pill-success',
  'Order Placed': 'rl-pill rl-pill-success',
  Lost: 'rl-pill rl-pill-danger',
  'Not Interested': 'rl-pill rl-pill-danger',
  Negotiating: 'rl-pill rl-pill-warning',
  Quoted: 'rl-pill rl-pill-info',
  Qualified: 'rl-pill rl-pill-info',
};
export function stagePillClass(value: string | null): string {
  return (value && STAGE_PILL_CLASS[value]) || 'rl-pill rl-pill-neutral';
}

export function distancePillClass(distance: string | null): string {
  return distance === 'Long Distance' ? 'rl-pill rl-pill-long' : 'rl-pill rl-pill-local';
}

export function chipList(items: string[], max = 4): string {
  if (items.length <= max) return items.join(', ');
  return `${items.slice(0, max).join(', ')} +${items.length - max} more`;
}
