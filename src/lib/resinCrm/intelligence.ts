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
  distance: string | null; // the group's distance tier — same for every row in the bucket
  productId: string | null; // first-seen product_id, preferred over name matching
  sum: number;
  count: number;
  min: number;
  max: number;
  last: number;
  lastAt: string;
}

export function buildCompetitorPricing(
  prices: ResinSupplierPrice[],
  products: ResinProduct[],
): CompetitorPriceRow[] {
  const productByName = new Map<string, ResinProduct>();
  const productById = new Map<string, ResinProduct>();
  for (const p of products) {
    if (p.name) productByName.set(norm(p.name), p);
    productById.set(p.id, p);
  }

  // Grouped by (supplier, product, distance) — Local and Long Distance prices
  // for the same supplier+product are genuinely different price points (Olympic
  // itself prices them on separate columns) and must not be blended together.
  // "Last" is resolved defensively by comparing captured_at on every row rather
  // than trusting the caller's query order.
  const map = new Map<string, PriceAcc>();
  for (const r of prices) {
    const price = r.price;
    const supplier = (r.supplier_name ?? '').trim();
    const product = (r.product_name ?? '').trim();
    if (!supplier || !product || price == null || !Number.isFinite(price)) continue;

    const key = `${norm(supplier)}|${norm(product)}|${norm(r.distance)}`;
    const e = map.get(key) ?? {
      supplier, product, distance: r.distance ?? null, productId: r.product_id ?? null,
      sum: 0, count: 0, min: price, max: price, last: price, lastAt: r.captured_at ?? '',
    };
    e.sum += price;
    e.count += 1;
    e.min = Math.min(e.min, price);
    e.max = Math.max(e.max, price);
    if (!e.productId && r.product_id) e.productId = r.product_id;
    if (!e.lastAt || (r.captured_at && r.captured_at >= e.lastAt)) {
      e.last = price;
      e.lastAt = r.captured_at ?? e.lastAt;
    }
    map.set(key, e);
  }

  const rows: CompetitorPriceRow[] = Array.from(map.values()).map((e) => {
    // Prefer the product_id captured at write time — free-text name matching
    // is only a fallback for rows that predate/lack that link.
    const matched = (e.productId && productById.get(e.productId))
      || productByName.get(norm(e.product))
      || null;
    const ourPrice = matched
      ? (e.distance === 'Long Distance' ? (matched.long_price ?? matched.local_price) : (matched.local_price ?? matched.long_price))
      : null;
    const gapPct = ourPrice != null && ourPrice !== 0
      ? Math.round(((e.last - ourPrice) / ourPrice) * 1000) / 10
      : null;

    return {
      supplier: e.supplier,
      product: e.product,
      distance: e.distance,
      last: e.last,
      avg: Math.round((e.sum / e.count) * 100) / 100,
      min: e.min,
      max: e.max,
      count: e.count,
      lastAt: e.lastAt,
      ourPrice,
      ourProductActive: matched ? matched.is_active : null,
      gapPct,
    };
  });

  return rows.sort((a, b) =>
    b.count - a.count || a.supplier.localeCompare(b.supplier) || a.product.localeCompare(b.product));
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
    // Ternaries (not `&&`) so a falsy-but-non-nullish id (e.g. an empty string)
    // still falls through to the next lookup instead of `??` treating '' as a
    // real, resolved value and stopping there.
    const company =
      (r.lead_id ? companyById.get(r.lead_id) : undefined) ??
      (r.lead_ref ? companyByRef.get(r.lead_ref) : undefined) ??
      'Unknown company';
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
