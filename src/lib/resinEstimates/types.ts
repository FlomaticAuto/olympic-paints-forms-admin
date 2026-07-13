// Types for the Olympic Resins estimate/quote system.
// Mirrors the resin_estimates / resin_estimate_lines tables.

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined';
export type PriceBasis = 'local' | 'long';

export interface ResinEstimate {
  id:              string;
  estimate_number: string;
  client:          string;
  contact_name:    string | null;
  contact_email:   string | null;
  contact_phone:   string | null;
  site:            string | null;
  date_issued:     string;
  valid_until:     string | null;
  status:          EstimateStatus;
  price_basis:     PriceBasis;
  notes:           string | null;
  terms:           string | null;
  prepared_by:     string | null;
  lead_id:         string | null;
  lead_ref:        string | null;
  pdf_url:         string | null;
  created_at:      string;
  updated_at:      string;
}

export interface ResinEstimateLine {
  id:           string;
  estimate_id:  string;
  product_id:   string | null;
  product_code: string | null;
  description:  string;
  category:     string | null;
  unit:         string | null;
  qty:          number;
  unit_price:   number;
  line_total:   number;
  sort_order:   number;
  created_at:   string;
}

// A line as posted from the form (before it becomes a DB row).
export interface RawEstimateLine {
  product_id?:   string | null;
  product_code?: string | null;
  description:   string;
  category?:     string | null;
  unit?:         string | null;
  qty:           number | string;
  unit_price:    number | string;
}
