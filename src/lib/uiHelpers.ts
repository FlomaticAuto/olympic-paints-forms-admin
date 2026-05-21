/**
 * Returns 'black' or 'white' depending on which gives better contrast
 * against the given hex background. Uses the relative-luminance
 * formula from WCAG 2.1. Hex input may be #RGB or #RRGGBB.
 */
export function pickContrastColour(hex: string): '#000000' | '#FFFFFF' {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const adj = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Returns true when a swatch needs a faint border to be visible
 * against the navy pane background (white-ish swatches disappear without one).
 */
export function needsSwatchBorder(hex: string): boolean {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Light enough that it visually blends into a light-rendered swatch
  return r + g + b > 720; // ~240 avg
}

export interface FormFields {
  category: string;
  product: string;
  colour: string;
  size: string;
  qty: number | '';
  returnType: string;
  batchNo: string;
  supervisor: string;
}

/**
 * Returns true when every required field is filled. Colour is required
 * unless the value is 'N/A' (set automatically when the product has no
 * meaningful colours).
 */
export function requiredFieldsFilled(f: FormFields): boolean {
  return (
    f.category !== '' &&
    f.product !== '' &&
    f.colour !== '' &&
    f.size !== '' &&
    typeof f.qty === 'number' && f.qty >= 1 &&
    f.returnType !== '' &&
    f.batchNo.trim() !== '' &&
    f.supervisor !== ''
  );
}
