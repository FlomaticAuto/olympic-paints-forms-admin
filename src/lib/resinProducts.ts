// Olympic Resins — product catalogue and pricing.
// Source: price list supplied Jul 2026. Prices in ZAR, per unit.
// Each product has a Local price and a Long-Distance price; which one applies
// is driven by the lead's `distance` classification.

export type Distance = 'Local' | 'Long Distance';

export interface ResinProduct {
  code:  string;
  name:  string;
  local: number;   // R, Local
  long:  number;   // R, Long Distance
}

export const RESIN_PRODUCTS: ResinProduct[] = [
  { code: 'RLA001-70', name: 'Long Oil Alkyd',   local: 37.84, long: 38.84 },
  { code: 'RSS325-55', name: 'Styrenated Alkyd',  local: 43.05, long: 44.05 },
  { code: 'RMA001-55', name: 'Medium Oil-Soya',   local: 40.80, long: 41.80 },
];

/** Unit price for a product code at the given distance. Returns 0 for unknown codes. */
export function priceFor(code: string, distance: Distance): number {
  const p = RESIN_PRODUCTS.find(x => x.code === code);
  if (!p) return 0;
  return distance === 'Long Distance' ? p.long : p.local;
}

export function productByCode(code: string): ResinProduct | undefined {
  return RESIN_PRODUCTS.find(x => x.code === code);
}
