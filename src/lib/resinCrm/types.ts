// Local row shapes for the resin-leads reporting dashboard (/admin/resin-leads).
// These tables aren't in the generated Supabase Database type (see src/lib/supabase/types.ts) —
// the rep-facing capture form (ResinLeadForm.tsx) already works around that with local
// interfaces, so the dashboard follows the same convention.

export type Distance = 'Local' | 'Long Distance';

// Canonical enums — single source of truth shared by the rep-facing capture
// form (ResinLeadForm.tsx) and this reporting dashboard, so filter dropdowns
// and badge colors never go stale relative to what reps can actually pick.
export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Quoted', 'Negotiating', 'Won', 'Lost'] as const;
export const VISIT_OUTCOMES = ['Introductory Meeting', 'Sample Requested', 'Quoted', 'Negotiating', 'Order Placed', 'Follow-up Required', 'Not Interested', 'Won', 'Lost'] as const;

export interface ResinLead {
  id: string;
  lead_ref: string;
  company: string;
  contact_person: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  lead_source: string | null;
  lead_status: string | null;
  distance: Distance;
  street: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  rep: string | null;
  notes: string | null;
  created_at: string;
  edits?: ResinLeadEdit[];
}

export interface ResinLeadEditChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ResinLeadEdit {
  id: string;
  lead_id: string;
  edited_by: string | null;
  changes: ResinLeadEditChange[];
  edited_at: string;
}

export interface ResinVisitProductLine {
  product_id: string | null;
  code: string | null;
  name: string;
  our_price: number | null;
  est_qty: number | null;
  order_every: number | null;
  order_unit: string | null;
  current_supplier: string | null;
  current_supplier_price: number | null;
  notes: string | null;
  est_value: number | null;
}

export interface ResinVisitEditChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ResinVisitEdit {
  id: string;
  visit_id: string;
  edited_by: string | null;
  changes: ResinVisitEditChange[];
  edited_at: string;
}

export interface ResinLeadVisit {
  id: string;
  visit_ref: string;
  lead_id: string;
  lead_ref: string;
  company: string;
  rep: string | null;
  visit_date: string;
  distance: string | null;
  outcome: string | null;
  next_follow_up: string | null;
  products: ResinVisitProductLine[];
  total: number | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  edits?: ResinVisitEdit[];
}

export interface ResinProduct {
  id: string;
  code: string | null;
  name: string;
  local_price: number | null;
  long_price: number | null;
  category: string | null;
  is_active: boolean;
  sort: number;
}

export interface ResinSupplierPrice {
  id: string;
  supplier_id: string | null;
  supplier_name: string;
  product_id: string | null;
  product_name: string;
  price: number | null;
  distance: string | null;
  lead_id: string | null;
  lead_ref: string | null;
  visit_ref: string | null;
  captured_at: string;
}

// ── Computed / derived shapes for the Intelligence tab ──────────────────────

export interface CompetitorPriceRow {
  supplier: string;
  product: string;
  distance: string | null;
  last: number;
  avg: number;
  min: number;
  max: number;
  count: number;
  lastAt: string;
  ourPrice: number | null;
  ourProductActive: boolean | null; // null = no catalogue match found at all
  gapPct: number | null; // positive = we're cheaper, negative = we're pricier
}

export interface CompetitorFootprintRow {
  supplier: string;
  companies: string[];
  leadCount: number;
  products: string[];
  lastCapturedAt: string;
}

export interface FieldNote {
  visitId: string;
  visitRef: string;
  company: string;
  rep: string | null;
  visitDate: string;
  outcome: string | null;
  notes: string;
  competitorMentions: ResinVisitProductLine[];
}

export interface StatTiles {
  totalLeads: number;
  totalVisits: number;
  competitorsTracked: number;
  pricePointsCaptured: number;
}
