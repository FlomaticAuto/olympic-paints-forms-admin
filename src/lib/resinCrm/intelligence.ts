import type {
  ResinLead,
  ResinLeadVisit,
  ResinProduct,
  ResinSupplierPrice,
  CompetitorPriceRow,
  CompetitorFootprintRow,
  FieldNote,
  StatTiles,
} from './types';

// Pure aggregation over already-fetched rows — no Supabase calls here, so these
// are easy to sanity-check independently of the page/client components.

const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

// ── Competitor pricing: what does competitor pricing look like, per product ──

interface PriceAcc {
  supplier: string;   // first-seen casing, for display
  product: string;    // first-seen casing, for display
  sum: number;
  count: number;
  min: number;
  max: number;
  last: number;
  lastAt: string;
  lastDistance: string | null;
}

export function buildCompetitorPricing(
  prices: ResinSupplierPrice[],
  products: ResinProduct[],
): CompetitorPriceRow[] {
  const productByName = new Map<string, ResinProduct>();
  for (const p of products) {
    if (p.name) productByName.set(norm(p.name), p);
  }

  // prices should already be ordered ascending by captured_at by the caller,
  // so "last" naturally reflects the most recent capture as we iterate.
  const map = new Map<string, PriceAcc>();
  for (const r of prices) {
    const price = r.price;
    const supplier = (r.supplier_name ?? '').trim();
    const product = (r.product_name ?? '').trim();
    if (!supplier || !product || price == null || !Number.isFinite(price)) continue;

    const key = `${norm(supplier)}|${norm(product)}`;
    const e = map.get(key) ?? {
      supplier, product, sum: 0, count: 0, min: price, max: price, last: price, lastAt: '', lastDistance: null,
    };
    e.sum += price;
    e.count += 1;
    e.min = Math.min(e.min, price);
    e.max = Math.max(e.max, price);
    e.last = price;
    e.lastAt = r.captured_at ?? e.lastAt;
    e.lastDistance = r.distance ?? e.lastDistance;
    map.set(key, e);
  }

  const rows: CompetitorPriceRow[] = Array.from(map.values()).map((e) => {
    const matched = productByName.get(norm(e.product)) ?? null;
    let ourPrice: number | null = null;
    if (matched) {
      ourPrice = e.lastDistance === 'Long Distance'
        ? (matched.long_price ?? matched.local_price)
        : (matched.local_price ?? matched.long_price);
    }
    const gapPct = ourPrice != null && ourPrice !== 0
      ? Math.round(((e.last - ourPrice) / ourPrice) * 1000) / 10
      : null;

    return {
      supplier: e.supplier,
      product: e.product,
      last: e.last,
      avg: Math.round((e.sum / e.count) * 100) / 100,
      min: e.min,
      max: e.max,
      count: e.count,
      lastAt: e.lastAt,
      ourPrice,
      gapPct,
    };
  });

  return rows.sort((a, b) => b.count - a.count || a.supplier.localeCompare(b.supplier));
}

// ── Competitor footprint: who is each competitor servicing ──────────────────

interface FootprintAcc {
  supplier: string;
  companies: Set<string>;
  products: Set<string>;
  lastCapturedAt: string;
}

export function buildCompetitorFootprint(
  prices: ResinSupplierPrice[],
  leads: ResinLead[],
): CompetitorFootprintRow[] {
  const companyById = new Map<string, string>();
  const companyByRef = new Map<string, string>();
  for (const l of leads) {
    companyById.set(l.id, l.company);
    if (l.lead_ref) companyByRef.set(l.lead_ref, l.company);
  }

  const map = new Map<string, FootprintAcc>();
  for (const r of prices) {
    const supplier = (r.supplier_name ?? '').trim();
    if (!supplier) continue;

    const key = norm(supplier);
    const e = map.get(key) ?? { supplier, companies: new Set<string>(), products: new Set<string>(), lastCapturedAt: '' };
    const company = (r.lead_id && companyById.get(r.lead_id))
      ?? (r.lead_ref && companyByRef.get(r.lead_ref))
      ?? 'Unknown company';
    e.companies.add(company);
    if (r.product_name) e.products.add(r.product_name.trim());
    if (r.captured_at && r.captured_at > e.lastCapturedAt) e.lastCapturedAt = r.captured_at;
    map.set(key, e);
  }

  const rows: CompetitorFootprintRow[] = Array.from(map.values()).map((e) => ({
    supplier: e.supplier,
    companies: Array.from(e.companies).sort(),
    leadCount: e.companies.size,
    products: Array.from(e.products).sort(),
    lastCapturedAt: e.lastCapturedAt,
  }));

  return rows.sort((a, b) => b.leadCount - a.leadCount || a.supplier.localeCompare(b.supplier));
}

// ── Recent field notes — qualitative colour to go with the tables above ─────

export function buildFieldNotes(visits: ResinLeadVisit[], limit = 20): FieldNote[] {
  return visits
    .filter((v) => v.notes && v.notes.trim())
    .sort((a, b) => (b.visit_date ?? '').localeCompare(a.visit_date ?? ''))
    .slice(0, limit)
    .map((v) => ({
      visitId: v.id,
      visitRef: v.visit_ref,
      company: v.company,
      rep: v.rep,
      visitDate: v.visit_date,
      outcome: v.outcome,
      notes: (v.notes ?? '').trim(),
      competitorMentions: (v.products ?? []).filter((p) => p.current_supplier),
    }));
}

// ── Stat tiles ────────────────────────────────────────────────────────────

export function buildStatTiles(
  leads: ResinLead[],
  visits: ResinLeadVisit[],
  prices: ResinSupplierPrice[],
): StatTiles {
  const competitors = new Set(prices.map((p) => norm(p.supplier_name)).filter(Boolean));
  return {
    totalLeads: leads.length,
    totalVisits: visits.length,
    competitorsTracked: competitors.size,
    pricePointsCaptured: prices.filter((p) => p.price != null).length,
  };
}
