# Returns Intake — Tablet Landscape Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/returns-intake` from a phone-style stacked-dropdown form into a 3-pane no-scroll tablet-landscape form with button-based controls and a visual colour swatch grid.

**Architecture:** Single-page React client component using CSS Grid for the 3-pane layout (`1fr 1.3fr 0.9fr`). Form state owned by parent (`ReturnIntakeForm`), with small presentational sub-components (`CategoryGrid`, `ProductList`, `ColourSwatchGrid`, `SizePills`, `QtyStepper`, `ReturnTypeGrid`, `SupervisorGrid`, `BatchInput`, `NotesField`) kept inside the same file. Product catalogue rewritten under 10 new categories. Colour hex codes split into a separate data file (`returnColourHex.ts`) so non-developers can edit them.

**Tech Stack:** Next.js 15 (App Router, React 19), TypeScript, vanilla CSS-in-JS via inline `<style>` block (matches existing form). No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-21-returns-intake-tablet-landscape-design.md`

**Testing note:** This repo has no test framework and no ESLint config installed. Verification per task is: (a) `npx tsc --noEmit -p tsconfig.json` passes, (b) `npm run build` passes, (c) where a pure helper exists, a one-shot Node script verifies the behaviour, (d) `npm run dev` + manual browser check on the new page. **Do NOT bootstrap ESLint** — `next lint` will fail without config and that is acceptable for this work; skip any lint step that surfaces during implementation. Final task includes a manual checklist verified on the actual tablet before sign-off.

---

## File Plan

**Create:**
- `src/lib/returnColourHex.ts` — single map of colour-name → `#hex`, with a `getColourHex(name)` helper that falls back to neutral grey.
- `src/lib/uiHelpers.ts` — small pure helpers (`pickContrastColour`, `requiredFieldsFilled`).

**Modify (full rewrite):**
- `src/lib/returnProductData.ts` — replace 12-category catalogue with new 10-category structure. Move Pink Wood Primer to Wood. Add Oxide category with TBD placeholder products.
- `src/components/ReturnIntakeForm.tsx` — replace phone-style stacked-dropdown layout with 3-pane button-based layout described in spec §4–§5.

**Untouched (verified by smoke test):**
- `src/app/returns-intake/page.tsx` — keeps existing import and prop wiring.
- `/api/submit/{formId}` and `/api/returns-notify` — backend stays identical.

---

## Task 1: Update product catalogue to new 10-category structure

**Files:**
- Modify: `src/lib/returnProductData.ts` (full rewrite)

- [ ] **Step 1: Replace `returnProductData.ts` with the new catalogue**

Open `src/lib/returnProductData.ts` and replace the entire file with:

```ts
// Product catalogue for the Returns Intake form.
// Sourced from: 2.Areas/8. Marketing/Product Guide/Product Colors.xlsx (2026-05-19)
// Restructured 2026-05-21 to a 10-category brand+chemistry hybrid.
// Category → Product → { colours, sizes }

export interface ProductInfo {
  colours: string[];
  sizes: string[];
}

export interface CategoryEntry {
  label: string;
  products: string[];
}

// Sizes available per product type
const ENAMEL_SIZES   = ['500ml', '1L', '5L', '20L'];
const PVA_SIZES      = ['5L', '20L'];
const ROOF_SIZES     = ['5L', '20L'];
const VARNISH_SIZES  = ['1L', '5L'];
const PRIMER_SIZES   = ['5L', '20L'];
const SMALL_SIZES    = ['500ml', '1L', '5L'];
const OXIDE_TBD      = ['TBD']; // placeholder until Quintus supplies sizes

export const CATEGORIES: CategoryEntry[] = [
  {
    label: 'Platinum',
    products: [
      'Platinum Plus Natural Elegance',
      'Platinum Plus Suburban Bliss',
      'Platinum Plus Rugged Beauty',
      'Platinum Plus Ultimate Shine',
      'Platinum Plus Plush Coat',
      'Platinum Plus All-In-One Protector',
    ],
  },
  {
    label: 'PVA',
    products: [
      'Master Decorators Acrylic PVA',
      'Kalahari Contractors PVA',
      'Decor Acrylic PVA',
      'Hi-Hiding Super Acrylic Contractors PVA',
      'Eclipse PVA',
      'Liberty PVA',
      '7-IN-1 Multipurpose Plus',
    ],
  },
  {
    label: 'Enamel',
    products: [
      'High Gloss Enamel',
      '3-IN-1 Gripcoat Enamel',
      'Pick \'n Save Econo Gloss Enamel',
      'Flat White Enamel',
      'Eggshell Enamel',
    ],
  },
  {
    label: 'QD',
    products: ['Quick Drying Enamel', 'QD Primer'],
  },
  {
    label: 'Primer',
    products: [
      'Universal Undercoat',
      'Water Based Plaster Primer',
      'Zinc Phosphate Primer',
    ],
  },
  {
    label: 'Oxide',
    products: [
      'Stainers',
      'Red Oxide Powder',
      'Black Oxide Powder',
      'Other Oxide Powder',
      'Distemper',
      'Water Based Red Oxide Primer',
      'Oxide Primer #2',
      'Oxide Primer #3',
    ],
  },
  {
    label: 'Roof',
    products: [
      'Universal Acrylic Roof & Paving Paint',
      'Alkyd Roof Paint',
      'Stoep Paint',
      '3-IN-1 Roof Paint',
    ],
  },
  {
    label: 'Waterproofing',
    products: ['Acrylic Rain Proof', 'Fibre Restore'],
  },
  {
    label: 'Wood',
    products: ['Wood Varnish', 'Pink Wood Primer'],
  },
  {
    label: 'Accessories',
    products: [
      'Putty',
      'Thinners',
      'Carborundum / Sandpaper',
      'Turpentine',
      'Paint Remover',
      'Other Accessory',
      'Other',
    ],
  },
];

export const PRODUCT_DATA: Record<string, ProductInfo> = {
  // ── Platinum ──
  'Platinum Plus Natural Elegance': {
    colours: ['White', 'Rice White', 'Casper Grey', 'White Whisper', 'Hazelnut Cream', 'Cream', 'Wild Orchid', 'Red Passion', 'Misty Storm', 'Wild Iris', 'Exotic Earth', 'Evening Glow'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Suburban Bliss': {
    colours: ['Rice White', 'Silver Mist', 'Bush Elephant', 'Night Sky', 'Wild Iris', 'Touch of Venus', 'Espresso Grey', 'Suede Grey', 'Jaipur', 'Peach', 'Sunset Yellow', 'Toasted Cashew', 'Ocean Foam', 'Wisdom', 'Sand', 'Storm', 'Vanilla'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Rugged Beauty': {
    colours: ['Rice White', 'Silver Mist', 'Bush Elephant', 'Night Sky', 'Wild Iris', 'Touch of Venus', 'Espresso Grey', 'Suede Grey', 'Jaipur', 'Peach', 'Sunset Yellow', 'Rim Rock', 'Ocean Foam', 'Wisdom', 'Sand', 'Storm', 'Vanilla'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Ultimate Shine': {
    colours: ['White', 'Black', 'Bright Yellow', 'Post Office Red', 'Golden Yellow', 'Light Brown', 'Light Blue', 'Dark Blue', 'Grey', 'Light Grey', 'Spring Green', 'Orange', 'Apricot', 'PWD Brown', 'Pink', 'Summer Blue', 'Ivory', 'Peach', 'Signal Red', 'Brilliant Green', 'Golden Brown', 'French Blue', 'Cream', 'Burgundy', 'Silver'],
    sizes: ENAMEL_SIZES,
  },
  'Platinum Plus Plush Coat': {
    colours: ['Black', 'Burgundy', 'Red', 'Terracotta', 'Brown', 'Emu', 'Albany', 'Grey', 'Charcoal', 'Ocean'],
    sizes: ROOF_SIZES,
  },
  'Platinum Plus All-In-One Protector': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },

  // ── PVA ──
  'Master Decorators Acrylic PVA': {
    colours: ['Rice White', 'Silver Sand', 'Brazil Nut', 'Desert Camel', 'Umhlanga Tan', 'Cream', 'Pebble Stone', 'Stone Grey', 'Shiloh', 'Night Sky', 'Fossil Green', 'Tennessee', 'African Kudu', 'Kalahari', 'Peach', 'Sunset Yellow', 'Autumn Wheat'],
    sizes: PVA_SIZES,
  },
  'Kalahari Contractors PVA': {
    colours: ['White', 'Jaipur', 'Cream', 'Coral', 'Moroccan Tan', 'Ceres Peach', 'Hazel', 'Silver Mist', 'Peach', 'Maize', 'Night Sky', 'Stone Grey', 'Rim Rock', 'Cranberry', 'Kiwi'],
    sizes: PVA_SIZES,
  },
  'Decor Acrylic PVA': {
    colours: ['White', 'Cream', 'Kiwi', 'Chestnut', 'Guava', 'Peach', 'Maize', 'Mushroom', 'Cranberry', 'Night Sky', 'Silver Mist'],
    sizes: PVA_SIZES,
  },
  'Hi-Hiding Super Acrylic Contractors PVA': {
    colours: ['White'],
    sizes: PVA_SIZES,
  },
  'Eclipse PVA': {
    colours: ['White', 'Cream', 'Peach', 'Pink', 'Blue', 'Green', 'Bushveld Brown', 'Sunshine Yellow', 'Aqua Blue', 'Tropical Sunset'],
    sizes: PVA_SIZES,
  },
  'Liberty PVA': {
    colours: ['White', 'Cream'],
    sizes: PVA_SIZES,
  },
  '7-IN-1 Multipurpose Plus': {
    colours: ['Sand Storm', 'Rim Rock', 'Stone Grey', 'Night Sky', 'Mushroom', 'Silver Mist', 'Pebble Stone', 'Espresso Grey'],
    sizes: PVA_SIZES,
  },

  // ── Enamel ──
  'High Gloss Enamel': {
    colours: ['White', 'Black', 'Signal Red', 'Light Brown', 'Grey', 'Summer Blue', 'Spring Green', 'Ivory', 'Burgundy', 'Bright Yellow', 'Maxi Peach', 'Cream', 'Golden Brown', 'Peach', 'Brilliant Green', 'PWD Brown'],
    sizes: ENAMEL_SIZES,
  },
  '3-IN-1 Gripcoat Enamel': {
    colours: ['Black', 'White', 'Bronze'],
    sizes: ['5L'],
  },
  'Pick \'n Save Econo Gloss Enamel': {
    colours: ['White', 'Green', 'Cream', 'Yellow', 'Blue', 'Peach', 'Golden Brown', 'Black', 'Pink'],
    sizes: ['5L', '20L'],
  },
  'Flat White Enamel': {
    colours: ['White'],
    sizes: ENAMEL_SIZES,
  },
  'Eggshell Enamel': {
    colours: ['White', 'Cream'],
    sizes: ENAMEL_SIZES,
  },

  // ── QD ──
  'Quick Drying Enamel': {
    colours: ['White', 'Dark Grey', 'Green', 'Black', 'Royal Blue', 'CAT Yellow', 'Bronze', 'PWD Brown', 'JD Green', 'Burgundy', 'Signal Red', 'Golden Brown', 'Silver'],
    sizes: ENAMEL_SIZES,
  },
  'QD Primer': {
    colours: ['Red Oxide', 'Grey'],
    sizes: SMALL_SIZES,
  },

  // ── Primer ──
  'Universal Undercoat': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },
  'Water Based Plaster Primer': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },
  'Zinc Phosphate Primer': {
    colours: ['Green'],
    sizes: SMALL_SIZES,
  },

  // ── Oxide (TBD — sizes/colours from Quintus) ──
  'Stainers':                       { colours: ['N/A'], sizes: OXIDE_TBD },
  'Red Oxide Powder':               { colours: ['N/A'], sizes: OXIDE_TBD },
  'Black Oxide Powder':             { colours: ['N/A'], sizes: OXIDE_TBD },
  'Other Oxide Powder':             { colours: ['N/A'], sizes: OXIDE_TBD },
  'Distemper':                      { colours: ['N/A'], sizes: OXIDE_TBD },
  'Water Based Red Oxide Primer':   { colours: ['Red'], sizes: PRIMER_SIZES },
  'Oxide Primer #2':                { colours: ['N/A'], sizes: OXIDE_TBD },
  'Oxide Primer #3':                { colours: ['N/A'], sizes: OXIDE_TBD },

  // ── Roof ──
  'Universal Acrylic Roof & Paving Paint': {
    colours: ['Red', 'Brown', 'Burgundy', 'Black', 'Grey', 'Charcoal', 'Terracotta', 'Green', 'Emu Green', 'Albany', 'Ocean Blue'],
    sizes: ROOF_SIZES,
  },
  'Alkyd Roof Paint': {
    colours: ['Red', 'Brown', 'Grey', 'Green', 'Burgundy', 'Aluminium', 'Black'],
    sizes: ROOF_SIZES,
  },
  'Stoep Paint': {
    colours: ['Red', 'Brown', 'Grey', 'Green', 'Burgundy', 'Aluminium', 'Black'],
    sizes: ROOF_SIZES,
  },
  '3-IN-1 Roof Paint': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal', 'Albany'],
    sizes: ROOF_SIZES,
  },

  // ── Waterproofing ──
  'Acrylic Rain Proof': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal'],
    sizes: ROOF_SIZES,
  },
  'Fibre Restore': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal'],
    sizes: ROOF_SIZES,
  },

  // ── Wood ──
  'Wood Varnish': {
    colours: ['Copal', 'Dark Oak', 'Ebony', 'Light Oak', 'Mahogany', 'Maple', 'Oak', 'Teak', 'Walnut'],
    sizes: VARNISH_SIZES,
  },
  'Pink Wood Primer': {
    colours: ['Pink'],
    sizes: SMALL_SIZES,
  },

  // ── Accessories ──
  'Putty':                    { colours: ['N/A'], sizes: ['500g', '1kg', '2kg', '5kg', 'Other'] },
  'Thinners':                 { colours: ['N/A'], sizes: ['1L', '2.5L', '5L', '20L', 'Other'] },
  'Carborundum / Sandpaper':  { colours: ['N/A'], sizes: ['60 grit', '80 grit', '120 grit', '180 grit', '240 grit', 'Other'] },
  'Turpentine':               { colours: ['N/A'], sizes: ['1L', '2.5L', '5L', '20L', 'Other'] },
  'Paint Remover':            { colours: ['N/A'], sizes: ['500ml', '1L', '5L', 'Other'] },
  'Other Accessory':          { colours: ['N/A'], sizes: ['500ml', '1L', '5L', '20L', 'Other'] },
  'Other':                    { colours: ['N/A'], sizes: ['500ml', '1L', '5L', '20L', 'Other'] },
};

export const SUPERVISORS = [
  'Piyush',
  'Mukesh',
  'Ravi',
  'Jagdish',
  'Masangita',
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (If the existing `tsconfig.tsbuildinfo` causes stale output, delete it first: `rm tsconfig.tsbuildinfo`.)

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint -- src/lib/returnProductData.ts`
Expected: no errors. (Warnings about quotes inside `'Pick \'n Save'` are acceptable.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/returnProductData.ts
git commit -m "feat(returns): restructure product catalogue to 10 categories

Replaces the 12-category enamel/PVA/specialty grouping with a
brand+chemistry hybrid (Platinum, PVA, Enamel, QD, Primer, Oxide,
Roof, Waterproofing, Wood, Accessories). Moves Pink Wood Primer
to Wood. Adds Oxide category with TBD product placeholders pending
spec section 10 data from Quintus."
```

---

## Task 2: Add colour-hex lookup file

**Files:**
- Create: `src/lib/returnColourHex.ts`

- [ ] **Step 1: Create the colour-hex file**

Create `src/lib/returnColourHex.ts` with:

```ts
// Hex codes for paint colour names used in the Returns Intake form.
// Best-effort approximations — Quintus will supply authoritative values.
// Missing names fall back to FALLBACK_HEX (neutral grey).

export const FALLBACK_HEX = '#5C5B58';

export const COLOUR_HEX: Record<string, string> = {
  // Whites & creams
  'White': '#FFFFFF',
  'Rice White': '#F4EFE6',
  'White Whisper': '#F2EDE6',
  'Ivory': '#FFFFF0',
  'Cream': '#F4E9C9',
  'Vanilla': '#F3E5AB',
  'Hazelnut Cream': '#D6B98C',

  // Blacks & greys
  'Black': '#000000',
  'Grey': '#808080',
  'Dark Grey': '#3F3F3F',
  'Light Grey': '#C0C0C0',
  'Silver': '#C0C0C0',
  'Silver Mist': '#BFC3C7',
  'Silver Sand': '#BDBAA1',
  'Casper Grey': '#8E8E8E',
  'Stone Grey': '#928E85',
  'Pebble Stone': '#A39C8B',
  'Espresso Grey': '#4D453F',
  'Suede Grey': '#7D7268',
  'Charcoal': '#2E2E2E',
  'Misty Storm': '#5C5C5E',
  'Storm': '#4F5D6A',
  'Shiloh': '#9C8E7E',
  'Wisdom': '#6E7A7E',

  // Reds, burgundies, pinks
  'Red': '#C0392B',
  'Red Passion': '#C8364C',
  'Signal Red': '#C8364C',
  'Post Office Red': '#A6192E',
  'Burgundy': '#800020',
  'Cranberry': '#9F1D35',
  'Pink': '#FFC0CB',
  'Coral': '#FF7F50',
  'Maxi Peach': '#FFC09F',
  'Peach': '#FFCBA4',
  'Ceres Peach': '#FFB58A',
  'Apricot': '#FBCEB1',
  'Guava': '#E37383',
  'Tropical Sunset': '#E66B4F',

  // Oranges, yellows
  'Orange': '#FF8C00',
  'Sunset Yellow': '#F2B33A',
  'Sunshine Yellow': '#FFD93B',
  'Bright Yellow': '#FFD700',
  'CAT Yellow': '#F0B500',
  'Golden Yellow': '#D4A017',
  'Maize': '#F2C66D',
  'Yellow': '#FFE600',

  // Greens
  'Green': '#3FB54F',
  'Spring Green': '#7FBF60',
  'Brilliant Green': '#3FB54F',
  'Emu Green': '#5E7E3E',
  'Emu': '#5E7E3E',
  'JD Green': '#367C2B',
  'Kiwi': '#8EB44F',
  'Fossil Green': '#6C7B5A',

  // Blues
  'Blue': '#1E88E5',
  'Light Blue': '#ADD8E6',
  'Dark Blue': '#003366',
  'Summer Blue': '#7CB9E8',
  'French Blue': '#0072BB',
  'Royal Blue': '#1335A0',
  'Aqua Blue': '#4FBDC8',
  'Ocean Blue': '#1B6AA1',
  'Ocean': '#1B6AA1',
  'Ocean Foam': '#B5D6D0',
  'Night Sky': '#1B2A4E',

  // Browns & tans
  'Brown': '#8B5A2B',
  'Light Brown': '#9B7653',
  'Bushveld Brown': '#6B4D2E',
  'Golden Brown': '#996515',
  'PWD Brown': '#5C4033',
  'Chestnut': '#7A4A2E',
  'Bronze': '#8C7853',
  'Brazil Nut': '#6D4A29',
  'Desert Camel': '#C3A07A',
  'Umhlanga Tan': '#B98A65',
  'Toasted Cashew': '#A57F58',
  'Hazel': '#A07852',
  'Moroccan Tan': '#B07D52',
  'Sand': '#C2B280',
  'Sand Storm': '#D6BE94',
  'Tennessee': '#8C6E47',
  'African Kudu': '#7A5C3E',
  'Kalahari': '#C6A678',
  'Autumn Wheat': '#D9B97A',
  'Mushroom': '#A39B89',
  'Bush Elephant': '#776E60',
  'Rim Rock': '#7A6E5D',
  'Exotic Earth': '#7B4A2A',
  'Evening Glow': '#D8923C',
  'Terracotta': '#C9602E',
  'Albany': '#7C4C2A',

  // Purples / violets / pinks
  'Wild Orchid': '#A4538C',
  'Wild Iris': '#7E6BA0',
  'Touch of Venus': '#C49AA8',
  'Jaipur': '#9D4A6B',

  // Aluminium
  'Aluminium': '#A8A9AD',

  // Wood varnish stains
  'Copal': '#B97A57',
  'Dark Oak': '#5C3A21',
  'Ebony': '#3E2C23',
  'Light Oak': '#C8A572',
  'Mahogany': '#73362A',
  'Maple': '#D9A06B',
  'Oak': '#A07550',
  'Teak': '#9E6A3C',
  'Walnut': '#5C4030',

  // Red Oxide variants
  'Red Oxide': '#A6432A',
};

export function getColourHex(name: string): string {
  return COLOUR_HEX[name] ?? FALLBACK_HEX;
}

export function hasKnownHex(name: string): boolean {
  return name in COLOUR_HEX;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/returnColourHex.ts
git commit -m "feat(returns): add colour-name to hex lookup table

Best-effort approximations for the visual swatch grid. Quintus
to supply authoritative values per spec section 10 item 1.
Unknown colour names fall back to neutral grey."
```

---

## Task 3: Add small UI helper functions

**Files:**
- Create: `src/lib/uiHelpers.ts`

- [ ] **Step 1: Create helpers file**

Create `src/lib/uiHelpers.ts` with:

```ts
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
```

- [ ] **Step 2: Verify with a one-shot Node script**

Create a temporary file `/tmp/test-helpers.mjs`:

```js
import { pickContrastColour, needsSwatchBorder, requiredFieldsFilled } from './src/lib/uiHelpers.ts';
// We use tsx to run a TS file directly.
```

Instead, run this inline check (no temp file needed) — note this uses `npx tsx` which is preinstalled with Next.js:

```bash
npx tsx -e "
import { pickContrastColour, needsSwatchBorder, requiredFieldsFilled } from './src/lib/uiHelpers';
console.log('pickContrastColour(#FFFFFF) =', pickContrastColour('#FFFFFF'), '(expect #000000)');
console.log('pickContrastColour(#000000) =', pickContrastColour('#000000'), '(expect #FFFFFF)');
console.log('pickContrastColour(#F5C400) =', pickContrastColour('#F5C400'), '(expect #000000)');
console.log('pickContrastColour(#003366) =', pickContrastColour('#003366'), '(expect #FFFFFF)');
console.log('needsSwatchBorder(#FFFFFF) =', needsSwatchBorder('#FFFFFF'), '(expect true)');
console.log('needsSwatchBorder(#1A3D6E) =', needsSwatchBorder('#1A3D6E'), '(expect false)');
console.log('requiredFieldsFilled empty =', requiredFieldsFilled({category:'',product:'',colour:'',size:'',qty:'',returnType:'',batchNo:'',supervisor:''}), '(expect false)');
console.log('requiredFieldsFilled full  =', requiredFieldsFilled({category:'PVA',product:'Decor Acrylic PVA',colour:'White',size:'5L',qty:2,returnType:'Rework',batchNo:'BT-1',supervisor:'Mukesh'}), '(expect true)');
"
```

Expected output:
```
pickContrastColour(#FFFFFF) = #000000 (expect #000000)
pickContrastColour(#000000) = #FFFFFF (expect #FFFFFF)
pickContrastColour(#F5C400) = #000000 (expect #000000)
pickContrastColour(#003366) = #FFFFFF (expect #FFFFFF)
needsSwatchBorder(#FFFFFF) = true (expect true)
needsSwatchBorder(#1A3D6E) = false (expect false)
requiredFieldsFilled empty = false (expect false)
requiredFieldsFilled full  = true (expect true)
```

If `npx tsx` is not available, fall back to manual visual inspection — these helpers are pure and small enough to read.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/uiHelpers.ts
git commit -m "feat(returns): add pure UI helpers (contrast, border, validation)

pickContrastColour picks black/white text against a hex background
using WCAG relative luminance. needsSwatchBorder flags near-white
hexes that need a faint border on the navy pane background.
requiredFieldsFilled validates the form-submit precondition."
```

---

## Task 4: Replace ReturnIntakeForm with the 3-pane tablet layout

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx` (full rewrite)

This is the bulk of the work. The replacement keeps the existing imports (`useState`, `FormEvent`, `CATEGORIES`, `PRODUCT_DATA`, `SUPERVISORS`), reuses the existing submit logic (`generateRef`, `todayLocal`, `onSubmit`), reuses the existing "Return Logged" thanks screen, and replaces only the render path between the `<form>` open tag and `<button type="submit">`.

- [ ] **Step 1: Write the replacement file**

Open `src/components/ReturnIntakeForm.tsx` and replace the entire file with:

```tsx
'use client';
import { useState, FormEvent } from 'react';
import { CATEGORIES, PRODUCT_DATA, SUPERVISORS } from '@/lib/returnProductData';
import { COLOUR_HEX, getColourHex } from '@/lib/returnColourHex';
import { pickContrastColour, needsSwatchBorder, requiredFieldsFilled } from '@/lib/uiHelpers';

interface Props { formId: string; }

function generateRef(): string {
  const now = new Date();
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RET-${yymmdd}-${rand}`;
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ReturnIntakeForm({ formId }: Props) {
  const [reportRef]  = useState<string>(() => generateRef());
  const [category,   setCategory]   = useState('');
  const [product,    setProduct]    = useState('');
  const [colour,     setColour]     = useState('');
  const [size,       setSize]       = useState('');
  const [qty,        setQty]        = useState<number | ''>('');
  const [supervisor, setSupervisor] = useState('');
  const [returnType, setReturnType] = useState('');
  const [batchNo,    setBatchNo]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [notesOpen,  setNotesOpen]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [done,       setDone]       = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const date = todayLocal();

  const categoryEntry = CATEGORIES.find(c => c.label === category);
  const productList   = categoryEntry?.products ?? [];
  const productInfo   = product ? PRODUCT_DATA[product] : null;
  const colourList    = productInfo?.colours ?? [];
  const sizeList      = productInfo?.sizes   ?? [];
  const colourIsNA    = colourList.length === 1 && colourList[0] === 'N/A';

  function handleCategoryChange(val: string) {
    setCategory(val);
    setProduct('');
    setColour('');
    setSize('');
  }

  function handleProductChange(val: string) {
    setProduct(val);
    setSize('');
    const info = val ? PRODUCT_DATA[val] : null;
    const colours = info?.colours ?? [];
    setColour(colours.length === 1 && colours[0] === 'N/A' ? 'N/A' : '');
  }

  function incQty() { setQty(typeof qty === 'number' ? qty + 1 : 1); }
  function decQty() {
    if (typeof qty === 'number' && qty > 1) setQty(qty - 1);
    else if (typeof qty === 'number' && qty === 1) setQty('');
  }

  const canSubmit = requiredFieldsFilled({
    category, product, colour, size, qty, returnType, batchNo, supervisor,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const data = {
      report_ref: reportRef,
      date,
      category,
      product,
      colour,
      size,
      qty: String(qty),
      return_type: returnType,
      batch_no: batchNo,
      supervisor,
      notes,
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          data,
          metadata: { form_type: 'returns_intake', report_ref: reportRef },
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? 'Submission failed. Please try again.');
        setBusy(false);
        return;
      }
      fetch('/api/returns-notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => { /* silent */ });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="ri-wrap">
        <div className="ri-thanks">
          <div className="ri-check">✓</div>
          <h1>Return Logged</h1>
          <p className="ri-ref">{reportRef}</p>
          <p className="ri-sub">Your return has been recorded. The supervisor has been notified.</p>
        </div>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </main>
    );
  }

  return (
    <main className="ri-wrap">
      <form onSubmit={onSubmit} className="ri-frame">

        {/* Header */}
        <header className="ri-header">
          <div className="ri-logo-wrap">
            <img src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg" alt="Olympic Paints" width={36} height={36} />
          </div>
          <div className="ri-title-block">
            <div className="ri-eyebrow">Olympic Paints</div>
            <h1>Returns Intake</h1>
          </div>
          <div className="ri-meta">
            <div className="ri-meta-item">
              <span className="ri-meta-label">Report No.</span>
              <span className="ri-meta-val">{reportRef}</span>
            </div>
            <div className="ri-meta-item">
              <span className="ri-meta-label">Date</span>
              <span className="ri-meta-val">{date}</span>
            </div>
          </div>
        </header>

        <div className="ri-panes">

          {/* LEFT PANE — Category + Product */}
          <section className="ri-pane">
            <div className="ri-step-label">1 · Category</div>
            <CategoryGrid value={category} onChange={handleCategoryChange} />
            {category && (
              <>
                <div className="ri-step-label">2 · Product</div>
                <ProductList products={productList} value={product} onChange={handleProductChange} />
              </>
            )}
          </section>

          {/* MIDDLE PANE — Colour */}
          <section className="ri-pane">
            <div className="ri-step-label">
              3 · Colour{product && !colourIsNA && <span className="ri-step-sub"> — {colourList.length} available</span>}
            </div>
            {!product && <EmptyHint text="Pick a product to see colours" />}
            {product && colourIsNA && (
              <div className="ri-na">Not applicable for this product</div>
            )}
            {product && !colourIsNA && (
              <ColourSwatchGrid colours={colourList} value={colour} onChange={setColour} />
            )}
          </section>

          {/* RIGHT PANE — everything else */}
          <section className="ri-pane">
            <div className="ri-step-label">4 · Size</div>
            {!product && <EmptyHint text="Pick a product to see sizes" />}
            {product && <SizePills sizes={sizeList} value={size} onChange={setSize} />}

            <div className="ri-step-label">5 · Quantity</div>
            <QtyStepper value={qty} onInc={incQty} onDec={decQty} />

            <div className="ri-step-label">6 · Return Type</div>
            <ReturnTypeGrid value={returnType} onChange={setReturnType} />

            <div className="ri-step-label">7 · Supervisor</div>
            <SupervisorGrid value={supervisor} onChange={setSupervisor} />

            <div className="ri-step-label">8 · Batch Number</div>
            <input
              type="text"
              className="ri-input"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              placeholder="e.g. BT-2026-0042"
              required
            />

            {!notesOpen && (
              <button type="button" className="ri-notes-toggle" onClick={() => setNotesOpen(true)}>
                + Add Notes (optional)
              </button>
            )}
            {notesOpen && (
              <div className="ri-notes-block">
                <div className="ri-step-label ri-notes-label">
                  9 · Notes
                  <button type="button" className="ri-notes-close" onClick={() => setNotesOpen(false)} aria-label="Close notes">×</button>
                </div>
                <textarea
                  className="ri-input"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Reason for return, damage description, batch info…"
                  rows={3}
                />
              </div>
            )}

            {error && <p className="ri-error">{error}</p>}

            <button type="submit" disabled={!canSubmit || busy} className="ri-submit">
              {busy ? 'Submitting…' : '✓ Log Return'}
            </button>
          </section>

        </div>
      </form>
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function EmptyHint({ text }: { text: string }) {
  return <div className="ri-empty">{text}</div>;
}

function CategoryGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-cat-grid">
      {CATEGORIES.map(c => (
        <button
          key={c.label}
          type="button"
          className={`ri-btn ${value === c.label ? 'is-active' : ''}`}
          aria-pressed={value === c.label}
          onClick={() => onChange(c.label)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function ProductList({ products, value, onChange }: { products: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-prod-list">
      {products.map(p => (
        <button
          key={p}
          type="button"
          className={`ri-btn ri-btn-wide ${value === p ? 'is-active' : ''}`}
          aria-pressed={value === p}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function ColourSwatchGrid({ colours, value, onChange }: { colours: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-swatch-grid">
      {colours.map(name => {
        const hex = getColourHex(name);
        const fg  = pickContrastColour(hex);
        const needsBorder = needsSwatchBorder(hex);
        const isMissing = !(name in COLOUR_HEX);
        return (
          <button
            key={name}
            type="button"
            className={`ri-swatch ${value === name ? 'is-selected' : ''} ${needsBorder ? 'has-border' : ''}`}
            style={{ background: hex, color: fg }}
            aria-pressed={value === name}
            title={isMissing ? `${name} — hex not yet set` : name}
            onClick={() => onChange(name)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function SizePills({ sizes, value, onChange }: { sizes: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-pill-row">
      {sizes.map(s => (
        <button
          key={s}
          type="button"
          className={`ri-btn ri-btn-pill ${value === s ? 'is-active' : ''}`}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function QtyStepper({ value, onInc, onDec }: { value: number | ''; onInc: () => void; onDec: () => void }) {
  return (
    <div className="ri-stepper">
      <button type="button" className="ri-btn ri-step-btn" onClick={onDec} aria-label="Decrease quantity">−</button>
      <div className={`ri-step-value ${value === '' ? 'is-empty' : ''}`}>{value === '' ? '0' : value}</div>
      <button type="button" className="ri-btn ri-step-btn" onClick={onInc} aria-label="Increase quantity">+</button>
    </div>
  );
}

function ReturnTypeGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = ['Rework', 'Inventory', 'Inv+Rework', 'Written Off'];
  return (
    <div className="ri-grid-2">
      {opts.map(o => (
        <button
          key={o}
          type="button"
          className={`ri-btn ${value === o ? 'is-active' : ''}`}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {o === 'Inv+Rework' ? 'Inv + Rework' : o}
        </button>
      ))}
    </div>
  );
}

function SupervisorGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="ri-grid-3">
      {SUPERVISORS.map((s, i) => (
        <button
          key={s}
          type="button"
          className={`ri-btn ${value === s ? 'is-active' : ''} ${i === SUPERVISORS.length - 1 && SUPERVISORS.length % 3 === 2 ? 'is-span-2' : ''}`}
          aria-pressed={value === s}
          onClick={() => onChange(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const css = `
  :root {
    --r-page: #0D2040;
    --r-pane: #1A3D6E;
    --r-pane-sunken: #071022;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #FFFFFF;
    --r-text-muted: #B8CCE8;
    --r-text-dim: #6B9ED0;
    --r-border: rgba(107,158,208,0.45);
    --r-border-soft: rgba(107,158,208,0.25);
    --r-danger-bg: rgba(232,96,96,0.14);
    --r-danger-fg: #FDDCDC;
    --r-danger-bd: rgba(232,96,96,0.35);
  }

  .ri-wrap {
    background: var(--r-page);
    min-height: 100vh;
    margin: 0;
    padding: 12px;
    font-family: 'Barlow', sans-serif;
    color: var(--r-text);
    box-sizing: border-box;
  }
  .ri-frame {
    background: var(--r-page);
    border-radius: 12px;
    padding: 0;
    height: calc(100vh - 24px);
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .ri-header {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--r-pane);
    border-radius: 10px;
    padding: 10px 16px;
    margin-bottom: 10px;
  }
  .ri-logo-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }
  .ri-logo-wrap img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .ri-title-block { line-height: 1; }
  .ri-eyebrow {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--r-text-dim);
  }
  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    text-transform: uppercase;
    color: var(--r-yellow);
    margin: 2px 0 0;
    line-height: 1;
  }
  .ri-meta { margin-left: auto; display: flex; gap: 18px; }
  .ri-meta-item { text-align: right; line-height: 1.1; }
  .ri-meta-label {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--r-text-dim);
  }
  .ri-meta-val {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 16px;
    color: var(--r-yellow);
    margin-top: 2px;
  }

  /* ── Panes ── */
  .ri-panes {
    display: grid;
    grid-template-columns: 1fr 1.3fr 0.9fr;
    gap: 10px;
    flex: 1;
    min-height: 0;
  }
  .ri-pane {
    background: var(--r-pane);
    border-radius: 10px;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .ri-step-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--r-yellow);
    margin: 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .ri-step-label + .ri-step-label { margin-top: 14px; }
  .ri-step-sub {
    color: var(--r-text-dim);
    font-weight: 700;
    font-size: 10px;
  }

  /* ── Buttons (shared) ── */
  .ri-btn {
    background: var(--r-page);
    border: 1px solid var(--r-border);
    color: var(--r-text);
    border-radius: 8px;
    padding: 11px 6px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s;
    line-height: 1.15;
    min-height: 44px;
  }
  .ri-btn:hover { background: var(--r-pane); }
  .ri-btn:focus-visible {
    outline: 2px solid var(--r-yellow);
    outline-offset: 2px;
  }
  .ri-btn.is-active {
    background: var(--r-yellow);
    color: var(--r-page);
    border-color: var(--r-yellow);
    font-weight: 900;
  }
  .ri-btn-wide {
    text-align: left;
    padding: 11px 12px;
    font-size: 13px;
  }
  .ri-btn-pill { flex: 1; }

  /* ── Category grid ── */
  .ri-cat-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 5px;
    margin-bottom: 6px;
  }

  /* ── Product list ── */
  .ri-prod-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    overflow-y: auto;
  }

  /* ── Empty hint ── */
  .ri-empty {
    color: var(--r-text-dim);
    font-size: 12px;
    text-align: center;
    padding: 20px 12px;
    border: 1px dashed var(--r-border-soft);
    border-radius: 8px;
    margin-bottom: 8px;
  }
  .ri-na {
    color: var(--r-text-muted);
    font-style: italic;
    font-size: 14px;
    text-align: center;
    padding: 40px 16px;
  }

  /* ── Colour swatch grid ── */
  .ri-swatch-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    flex: 1;
    align-content: start;
  }
  .ri-swatch {
    border-radius: 8px;
    padding: 12px 4px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 1.15;
    cursor: pointer;
    border: 2px solid transparent;
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.08s;
  }
  .ri-swatch.has-border:not(.is-selected) {
    border-color: var(--r-border-soft);
  }
  .ri-swatch:hover { transform: scale(1.03); }
  .ri-swatch:focus-visible {
    outline: 2px solid var(--r-yellow);
    outline-offset: 2px;
  }
  .ri-swatch.is-selected {
    border-color: var(--r-yellow);
    box-shadow: 0 0 0 2px var(--r-pane), 0 0 0 4px var(--r-yellow);
  }

  /* ── Pill row ── */
  .ri-pill-row { display: flex; gap: 5px; }

  /* ── Stepper ── */
  .ri-stepper { display: flex; gap: 5px; align-items: stretch; }
  .ri-step-btn { flex: 0 0 56px; font-size: 22px; font-weight: 900; padding: 8px; line-height: 1; }
  .ri-step-value {
    flex: 1;
    background: var(--r-page);
    border: 1px solid var(--r-border);
    border-radius: 8px;
    text-align: center;
    padding: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    color: var(--r-yellow);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
  }
  .ri-step-value.is-empty { color: rgba(255,255,255,0.25); }

  /* ── 2×2 / 3-col grids ── */
  .ri-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }
  .ri-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }
  .ri-grid-3 .is-span-2 { grid-column: span 2; }

  /* ── Text input / textarea ── */
  .ri-input {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 12px;
    min-height: 44px;
    font-size: 14px;
    font-family: 'Barlow', sans-serif;
    background: var(--r-page);
    color: var(--r-text);
    border: 1px solid var(--r-border);
    border-radius: 8px;
    appearance: none;
    -webkit-appearance: none;
  }
  textarea.ri-input { min-height: 80px; resize: vertical; }
  .ri-input:focus {
    outline: 2px solid var(--r-yellow);
    outline-offset: 2px;
    border-color: var(--r-yellow);
  }

  /* ── Notes toggle ── */
  .ri-notes-toggle {
    background: transparent;
    border: 1px dashed var(--r-border);
    color: var(--r-text-dim);
    border-radius: 8px;
    padding: 10px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    cursor: pointer;
    margin-top: 12px;
  }
  .ri-notes-toggle:hover { background: var(--r-pane); }
  .ri-notes-block { margin-top: 12px; }
  .ri-notes-label { justify-content: space-between; }
  .ri-notes-close {
    background: transparent; border: 0; color: var(--r-text-dim);
    font-size: 18px; line-height: 1; cursor: pointer;
    padding: 0 6px;
  }

  /* ── Submit ── */
  .ri-submit {
    width: 100%;
    padding: 14px;
    min-height: 52px;
    background: var(--r-yellow);
    color: var(--r-page);
    border: 0;
    border-radius: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 16px;
    cursor: pointer;
    margin-top: auto;
    transition: background 0.15s, opacity 0.15s;
  }
  .ri-submit:hover:not(:disabled) { background: var(--r-yellow-hover); }
  .ri-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .ri-error {
    color: var(--r-danger-fg);
    background: var(--r-danger-bg);
    border: 1px solid var(--r-danger-bd);
    padding: 10px;
    border-radius: 8px;
    margin-top: 10px;
    font-size: 13px;
  }

  /* ── Thanks screen ── */
  .ri-thanks {
    max-width: 520px;
    margin: 80px auto;
    background: var(--r-pane);
    border-radius: 12px;
    padding: 40px 24px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .ri-check { font-size: 48px; color: #2D8C7A; margin-bottom: 16px; }
  .ri-ref {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 22px;
    color: var(--r-yellow);
    margin: 8px 0;
    letter-spacing: 0.04em;
  }
  .ri-sub { color: var(--r-text-muted); font-size: 15px; line-height: 1.5; margin-top: 12px; }

  /* ── Responsive ── */
  /* Phone / narrow — stack panes vertically. */
  @media (max-width: 900px) {
    .ri-panes { grid-template-columns: 1fr; }
    .ri-frame { height: auto; }
    .ri-pane { overflow-y: visible; }
    .ri-header { flex-wrap: wrap; }
    .ri-meta { width: 100%; margin-left: 0; justify-content: flex-start; }
  }
`;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors. Warnings about `dangerouslySetInnerHTML` are pre-existing and acceptable.

- [ ] **Step 4: Verify production build passes**

Run: `npm run build`
Expected: build succeeds. The `/returns-intake` route appears in the route summary.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns): rebuild form as 3-pane tablet-landscape layout

Replaces the phone-style stacked-dropdown layout with a no-scroll
3-pane working surface for the factory's 10-inch landscape tablet:
- 5x2 category button grid + stacked product list (left pane)
- 5-column visual swatch grid with actual paint colours (middle)
- Size pills, quantity stepper, return type 2x2, supervisor 3-col,
  batch input, collapsible notes, big submit (right)

No backend changes — submit endpoint, Telegram notification, and
thanks screen are identical. Mobile breakpoint stacks the panes
vertically.

Closes spec section 4-5 / 2026-05-21-returns-intake-tablet-landscape-design.md"
```

---

## Task 5: Manual verification on dev server

This task is verification only — no code changes. It exists to make sure the form actually works before sign-off.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` (or another port if 3000 is taken). Wait for "Ready" log line.

- [ ] **Step 2: Open the form**

Browse to `http://localhost:3000/returns-intake`. Set the browser viewport to 1280×800 (Chrome DevTools → Device Toolbar → Responsive 1280×800) to match the tablet.

- [ ] **Step 3: Walk through the happy path**

Complete this sequence and tick each item:

  - [ ] Page renders inside one viewport — no vertical scroll bar on the outer frame.
  - [ ] Header shows logo + "RETURNS INTAKE" + a fresh Report No. + today's date.
  - [ ] Tap **Platinum** in the category grid → it turns yellow; the Product list appears below it.
  - [ ] Tap **Platinum Plus Ultimate Shine** → middle pane shows a 5×5 swatch grid (25 colours); right pane shows 4 size pills (500ml/1L/5L/20L).
  - [ ] Tap the **Bright Yellow** swatch → it gets a yellow selection ring; text colour inside the swatch stays readable.
  - [ ] Tap **20L** size → pill turns yellow.
  - [ ] Tap the **+** stepper button 3 times → quantity reads "3" in yellow.
  - [ ] Tap **Rework** return type → button turns yellow.
  - [ ] Tap **Mukesh** supervisor → button turns yellow.
  - [ ] Type `BT-2026-0042` into the batch field.
  - [ ] **Log Return** button at the bottom is no longer disabled.
  - [ ] Tap **+ Add Notes** → textarea expands inline; type "Damage during transit" → close it with the × button → notes value is retained.
  - [ ] Tap **Log Return** → either the thanks screen appears (if the Supabase form ID is set and the API is reachable) or you see the existing error banner. **Both outcomes are acceptable here** — the only thing we are verifying is that the form was correctly assembled and submission was triggered.

- [ ] **Step 4: Walk through the Accessories edge case**

Reload the page. Tap **Accessories** → tap **Putty** → confirm:

  - [ ] Middle pane shows "Not applicable for this product" instead of swatches.
  - [ ] Right pane shows the 5 Putty sizes (500g, 1kg, 2kg, 5kg, Other) as pills.
  - [ ] Selecting a size + qty + return type + supervisor + batch number enables the submit button — colour is not required.

- [ ] **Step 5: Walk through the Oxide TBD case**

Reload. Tap **Oxide** → tap **Stainers** → confirm:

  - [ ] Middle pane shows "Not applicable for this product" (because the placeholder has `colours: ['N/A']`).
  - [ ] Right pane shows a single size pill labelled "TBD".
  - [ ] Submit is enabled once the TBD pill is selected and the rest of the form is filled.
  - This confirms the form does not crash for placeholder products — production hex/sizes can be filled in later without code changes.

- [ ] **Step 6: Verify responsive fallback at phone width**

Set viewport to 414×896 (iPhone). Reload `/returns-intake`. Confirm:

  - [ ] Panes stack vertically (Category/Product on top, Colour below, the rest at the bottom).
  - [ ] Page scrolls vertically — no horizontal scroll.
  - [ ] Buttons remain tappable.

- [ ] **Step 7: Commit any small fixes found during verification**

If the walkthrough surfaced bugs, fix them and commit. If everything works, no commit is needed for this task.

---

## Task 6: Deploy to Vercel and verify on the actual factory tablet

- [ ] **Step 1: Push the branch and wait for Vercel preview build**

```bash
git push -u origin <branch-name>
```

Open the GitHub PR / Vercel preview URL when the build completes. Verify the same happy path from Task 5 on the preview URL.

- [ ] **Step 2: Test on the factory tablet**

Take the tablet to the factory floor and open the preview URL. Tick:

  - [ ] Page fits within the tablet's landscape viewport — no scroll bar.
  - [ ] Every button is tappable with a gloved finger on the first try (no double-tap).
  - [ ] Logging one complete return takes ≤15 seconds (target from spec §11).
  - [ ] The thanks screen appears after submit and the Telegram notification fires.

- [ ] **Step 3: Promote to production**

If the tablet check passes, merge the PR. Vercel will deploy to production automatically. Confirm `https://olympic-paints-forms-admin.vercel.app/returns-intake` shows the new layout.

- [ ] **Step 4: Update the spec**

Mark spec §10 item 3 (factory tablet verification) as **done** with the date and the confirmed resolution. Append a note about any colour names that needed hex corrections — the missing-hex `title=` tooltips that surfaced during the walkthrough are the to-do list for Quintus's next hex-update pass.

---

## Self-Review

**1. Spec coverage** — every spec section accounted for:

| Spec § | Covered by |
|---|---|
| §4 3-pane layout | Task 4 CSS `.ri-panes` grid |
| §5.1 Header | Task 4 `<header>` block |
| §5.2 Category grid | Task 4 `CategoryGrid` + Task 1 `CATEGORIES` order |
| §5.3 Product list + mapping | Task 1 catalogue + Task 4 `ProductList` |
| §5.4 Colour swatches | Task 2 hex map + Task 3 contrast helper + Task 4 `ColourSwatchGrid` |
| §5.5 Size pills | Task 4 `SizePills` |
| §5.6 Qty stepper | Task 4 `QtyStepper` (state `number \| ''`) |
| §5.7 Return type | Task 4 `ReturnTypeGrid` |
| §5.8 Supervisor grid | Task 4 `SupervisorGrid` (5-element span-2 logic) |
| §5.9 Batch input | Task 4 `<input>` |
| §5.10 Collapsed notes | Task 4 `notesOpen` state + toggle |
| §5.11 Submit + validation | Task 3 `requiredFieldsFilled` + Task 4 `canSubmit` |
| §6 Brand tokens | Task 4 CSS custom properties |
| §7 State shape | Task 4 `useState` block matches |
| §8 a11y (aria-pressed, focus ring) | Task 4 each button + `:focus-visible` |
| §8 responsive | Task 4 `@media (max-width:900px)` |
| §10 verification + open items | Tasks 5 + 6 |

**2. Placeholder scan** — no TBD / TODO / "add error handling" / "similar to Task N" in any step. The literal string "TBD" appears only inside the product catalogue (Task 1) for Oxide products, which is intentional and tracked in spec §10.

**3. Type consistency** — `FormFields` in Task 3 matches `useState` shape in Task 4 (`category`, `product`, `colour`, `size`, `qty`, `returnType`, `batchNo`, `supervisor`). Helper names `getColourHex` / `pickContrastColour` / `needsSwatchBorder` / `requiredFieldsFilled` referenced identically in both files. CSS class names (`ri-btn`, `is-active`, `ri-swatch-grid`, `ri-stepper`) are defined once in Task 4 and used only within the same file.

Self-review clean.
