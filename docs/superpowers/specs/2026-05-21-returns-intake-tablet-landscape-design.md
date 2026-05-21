# Returns Intake — Tablet Landscape Redesign

**Date:** 2026-05-21
**Author:** Quintus Lategan (via brainstorming session)
**Status:** Approved — ready for implementation plan
**Target route:** `/returns-intake` on `olympic-paints-forms-admin.vercel.app`
**Component:** `src/components/ReturnIntakeForm.tsx`
**Product catalogue:** `src/lib/returnProductData.ts`

---

## 1. Problem

The current Returns Intake form is a single-column phone layout (~520px max width) with seven stacked dropdowns. The actual device is a **10-inch tablet held in landscape** at ~1280×800. On that screen the phone layout:

- Wastes ~70% of horizontal space.
- Forces the operator to scroll to see all fields.
- Hides every choice behind a native `<select>` dropdown, which on Android opens a modal sheet with small typography. With 25 colours in Ultimate Shine, the dropdown is a long vertical list with no visual cue per option.
- Slows the workflow on the factory floor, where the operator may be wearing gloves and standing at a workbench.

## 2. Goal

Rebuild the form for **tablet landscape** so:

1. One return = one screen. No scrolling.
2. Every selection is a **tap target ≥ ~48px high**, no native dropdowns anywhere except the (currently unused) textarea.
3. Category, product, colour, size, return type, and supervisor are direct buttons — visible at all times, with the active selection painted yellow.
4. Colour selection shows the **actual paint colour** as a swatch the operator recognises visually.

Out of scope:

- Changes to the submission endpoint, Telegram notification, or Supabase schema.
- Changes to the phone form (this is a new layout for a different device class; the existing form can remain available for phones).

## 3. Hardware target

| Property | Value |
|---|---|
| Device | Generic 10-inch Android tablet |
| Orientation | Landscape, locked |
| Resolution | 1280 × 800 CSS pixels (assumed) |
| Touch target floor | 48 px in either axis |
| Distance | Held at workbench / arm's length |

The page must remain usable down to **1024×768** (older 10″ tablets). At ≥1280 it uses the full reference layout; from 1024–1279 widths the panes scale proportionally.

## 4. Page layout — three panes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [logo]  OLYMPIC PAINTS                          Report No.  RET-260521-4821│
│          RETURNS INTAKE                          Date        2026-05-21     │
├─────────────────────────────────────────────────────────────────────────────┤
│  LEFT PANE (1 fr)     │  MIDDLE PANE (1.3 fr)         │  RIGHT PANE (0.9 fr)│
│  ────────────────     │  ──────────────────────       │  ───────────────────│
│  1 · Category         │  3 · Colour — N available     │  4 · Size           │
│  [5×2 grid buttons]   │  [5-column swatch grid]       │  [pill row]         │
│                       │                               │                     │
│  2 · Product          │                               │  5 · Quantity       │
│  [stacked list]       │                               │  [− value +]        │
│                       │                               │                     │
│                       │                               │  6 · Return Type    │
│                       │                               │  [2×2 grid]         │
│                       │                               │                     │
│                       │                               │  7 · Supervisor     │
│                       │                               │  [3-col grid]       │
│                       │                               │                     │
│                       │                               │  8 · Batch Number   │
│                       │                               │  [text input]       │
│                       │                               │                     │
│                       │                               │  + Add Notes        │
│                       │                               │                     │
│                       │                               │  [   LOG RETURN   ] │
└─────────────────────────────────────────────────────────────────────────────┘
```

CSS grid: `grid-template-columns: 1fr 1.3fr 0.9fr`, `gap: 10px`, panes have `padding: 12px`, `border-radius: 10px`, `background: #1A3D6E` on a `#0D2040` page.

## 5. Field-by-field specification

### 5.1 Header bar

- Olympic Paints logo on the left (use the canonical hosted JPG at `https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg`, wrapped in `border-radius:50%;overflow:hidden`).
- Brand eyebrow + "RETURNS INTAKE" title (Barlow Condensed 900, 22 px).
- Report No. + Date pushed to the right of the bar (Barlow Condensed 900, 16 px, in `--color-brand-primary` on `--color-info-bg`).

### 5.2 Step 1 — Category (5×2 button grid)

10 categories, exactly two rows of five. Each tile ~110×70 px. Two-line labels permitted for "Water-proofing" and "Access-ories".

| Row | Buttons |
|---|---|
| 1 | Platinum · PVA · Enamel · QD · Primer |
| 2 | Oxide · Roof · Waterproofing · Wood · Accessories |

Tapping a category:
- Paints that tile in `--color-brand-primary` (yellow on navy).
- Replaces the Product list below with that category's products.
- Resets product, colour, and size selections.

### 5.3 Step 2 — Product (stacked button list)

Below the category grid, in the same left pane. One full-width button per product, ordered as in the catalogue. Buttons grow downward; the pane scrolls vertically only if necessary (longest list will be ≤8 items).

**Product-to-category mapping** (replaces the current 12-category structure):

| Category | Products |
|---|---|
| Platinum | Platinum Plus Natural Elegance · Platinum Plus Suburban Bliss · Platinum Plus Rugged Beauty · Platinum Plus Ultimate Shine · Platinum Plus Plush Coat · Platinum Plus All-In-One Protector |
| PVA | Master Decorators Acrylic PVA · Kalahari Contractors PVA · Decor Acrylic PVA · Hi-Hiding Super Acrylic Contractors PVA · Eclipse PVA · Liberty PVA · 7-IN-1 Multipurpose Plus |
| Enamel | High Gloss Enamel · 3-IN-1 Gripcoat Enamel · Pick 'n Save Econo Gloss Enamel · Flat White Enamel · Eggshell Enamel |
| QD | Quick Drying Enamel · QD Primer |
| Primer | Universal Undercoat · Water Based Plaster Primer · Zinc Phosphate Primer |
| Oxide | **TBD** — Stainers · Red Oxide Powder · Black Oxide Powder · Other Oxide Powder · Distemper · Water Based Red Oxide Primer · Oxide Primer #2 (name TBD) · Oxide Primer #3 (name TBD) |
| Roof | Universal Acrylic Roof & Paving Paint · Alkyd Roof Paint · Stoep Paint · 3-IN-1 Roof Paint |
| Waterproofing | Acrylic Rain Proof · Fibre Restore |
| Wood | Wood Varnish · Pink Wood Primer |
| Accessories | Putty · Thinners · Carborundum / Sandpaper · Turpentine · Paint Remover · Other Accessory · Other |

**Open data items** to fill in before launch (track in `0.Inbox/` or a follow-up message):

- Oxide → Stainers: colours? sizes?
- Oxide → Red Oxide Powder / Black Oxide Powder / Other Oxide Powder: pack sizes?
- Oxide → Distemper: colours? sizes?
- Oxide → Oxide Primer #2 and #3: names, colours, sizes?

The spec proceeds with these as placeholders; the form will not break, but those products will be incomplete until data is provided.

Tapping a product paints it yellow and reveals the Colour swatches (middle pane) and Size pills (right pane).

### 5.4 Step 3 — Colour (visual swatch grid, middle pane)

A 5-column grid of swatches in the middle pane. Each swatch:

- Fixed minimum size: ~110 × 50 px (5 columns × 5 rows fits the worst-case 25-colour product).
- Background is the actual paint colour (CSS `background-color: var(--hex)`).
- Text colour automatically chosen for contrast (white on dark, black on light — via a small helper).
- Colour name overlaid in Barlow Condensed 700, 11 px, UPPERCASE, letter-spacing 0.02em.
- Selected swatch gets a 2 px yellow outline + 2 px navy spacer + 2 px yellow outer ring (focus-ring style).
- For Cream / Ivory / White / Silver — add a 1 px `rgba(107,158,208,0.5)` border so the swatch is visible against the navy pane background.

**Hex code source.** Hex values are owned in `src/lib/returnColourHex.ts` as a single map:

```ts
export const COLOUR_HEX: Record<string, string> = {
  'White': '#FFFFFF',
  'Black': '#000000',
  // … one entry per distinct colour name across all products
};
```

Quintus will supply the authoritative hex values. Until then the file ships with **best-effort approximations** (the mockup palette is the starting point). Missing colours fall back to a neutral grey `#5C5B58` with a small ⚠ marker — the form still works, the operator can still pick, and the missing-hex name is flagged in dev console.

If a product's `colours` array contains only `'N/A'`, the swatch grid is replaced with the static text "Not applicable for this product" and the colour value is auto-set to `N/A` on submit (matches the current behaviour for Accessories).

### 5.5 Step 4 — Size (pill row, right pane top)

One-row pill button group inside the right pane. 2–6 pills per product (already a small set in the catalogue). Single-select; selected pill in yellow.

If only one size is available, the form still shows it as a single pill (pre-selected) so the operator can see what's happening — no "auto-skip" behaviour.

### 5.6 Step 5 — Quantity (stepper)

`[ − ] [   value   ] [ + ]`. Buttons ~50 × 48 px, value display ~64 × 48 px in Barlow Condensed 900, 22 px, brand yellow on navy. Minimum value 1, no maximum, integer only.

State shape: `qty: number | ''`. Initial value `''`; the display shows a dim "0" placeholder in `--color-text-tertiary`. Tapping **+** for the first time sets qty to 1. Submit validation requires `qty >= 1`. Long-press on **+** or **−** repeats every 200ms (nice-to-have, not required for first release).

### 5.7 Step 6 — Return Type (2×2 button grid)

| Top row | Bottom row |
|---|---|
| Rework | Inventory |
| Inv + Rework | Written Off |

Single-select. Values stored to the existing `return_type` field unchanged (`Rework`, `Inventory`, `Inv+Rework`, `Written Off`).

### 5.8 Step 7 — Supervisor (3-column button grid)

```
[ Piyush  ] [ Mukesh   ] [ Ravi    ]
[ Jagdish ] [ Masangita (spans 2)  ]
```

Single-select. Same 5 names as today; can be data-driven from `SUPERVISORS` constant.

### 5.9 Step 8 — Batch Number (text input)

Plain text input, monospace, ~13 px. Placeholder "e.g. BT-2026-0042". Required, free-form (no validation beyond non-empty).

### 5.10 Notes (collapsed)

By default, a dashed-border "+ Add Notes (optional)" button. Tapping it expands a 3-row textarea in place, with a subtle close ("×") icon. Notes that the operator enters are kept on the form until submit even if collapsed again. Empty notes are submitted as empty string (matches current behaviour).

### 5.11 Submit

Big yellow "✓ Log Return" button at the bottom of the right pane. Full-width within the pane, ~52 px tall, Barlow Condensed 900 16 px. Disabled state at 50% opacity with `cursor: not-allowed`. Disabled until all required fields are filled:

- Category, product, size, qty (≥1), return type, supervisor, batch number — and colour unless the product's only colour is `N/A`.

On submit: same flow as today — `POST /api/submit/{formId}` then non-blocking `POST /api/returns-notify`. On success, replace the form with the existing "Return Logged" thanks screen (already implemented in the current component).

## 6. Visual / brand system

Use the project's existing tokens from `CLAUDE.md`:

- Theme: navy (`#0D2040` page, `#1A3D6E` pane, `#F5C400` brand accent, `#fff` text primary, `#6B9ED0` text secondary, `#B8CCE8` text muted).
- Fonts: Barlow Condensed (labels, buttons), Barlow (body, inputs).
- Buttons: `border-radius: 8px`, 1 px navy-on-blue border, hover lightens background. Active state: yellow fill, navy text, weight 900.
- Logo: hosted JPG, never the SVG, always wrapped in a 36 px circle.
- No theme toggle on this page — supervisors don't need it; navy is the default and the only theme.

## 7. State & data flow

Same React `useState` shape as today, with two additions:

- `qty` becomes a number (was a string). Stepper writes integers.
- `colour` is set automatically to `'N/A'` when the product's `colours` array is `['N/A']`.

The component remains a single file (`src/components/ReturnIntakeForm.tsx`) but its internal structure is reorganised into small subcomponents kept within the same file:

- `CategoryGrid({ value, onChange })`
- `ProductList({ category, value, onChange })`
- `ColourSwatchGrid({ product, value, onChange })`
- `SizePills({ product, value, onChange })`
- `QtyStepper({ value, onChange })`
- `ReturnTypeGrid`, `SupervisorGrid`, `BatchInput`, `NotesField`

Each subcomponent reads only the props it needs. The parent owns all form state and submission.

The product catalogue (`src/lib/returnProductData.ts`) is rewritten to use the new 10-category structure. The shape stays the same (`CATEGORIES` + `PRODUCT_DATA` + `SUPERVISORS`), so any consumer outside the form (none currently) would keep working.

## 8. Accessibility & robustness

- All buttons have `aria-pressed` reflecting their active state.
- The colour name is always visible in text — colour-blind operators see the name, not just the swatch.
- Focus ring (2 px yellow outline + offset) on keyboard nav.
- Layout degrades gracefully below 600px width by stacking the three panes vertically (no horizontal scrolling). The existing phone form lives on a separate route — see §10 item 4 for the routing decision.
- Tested on the actual tablet before sign-off.

## 9. Implementation notes

- New file: `src/lib/returnColourHex.ts` (single export `COLOUR_HEX`).
- Updated file: `src/lib/returnProductData.ts` (new categories, new product mapping, Pink Wood Primer moved to Wood, Oxide category added with TBD placeholders).
- Rewritten file: `src/components/ReturnIntakeForm.tsx` (3-pane layout, button-based controls, stepper, swatch grid).
- No new dependencies.
- The submit endpoint, Telegram notification, and Supabase form ID env var (`RETURNS_INTAKE_FORM_ID`) all stay as-is.

## 10. Open items before launch

1. Hex codes for every colour name (Quintus to supply).
2. Oxide category — full product list with sizes and colours (Quintus to supply).
3. Pre-deployment, test on the actual factory tablet at 1280×800 (and confirm exact resolution).
4. Decide whether to keep the existing phone form on a separate route (e.g. `/returns-intake/mobile`) or remove it. Current recommendation: keep it; route `/returns-intake` becomes the tablet form, `/returns-intake/mobile` stays as the phone form for ad-hoc use. **Quintus to confirm.**

## 11. Success criteria

- Operator can log one return in ≤15 seconds without scrolling on the target tablet.
- All controls hit the 48 px touch target floor.
- No native `<select>` rendered anywhere in the form.
- Submit + Telegram + thanks-screen flow is identical to today (no regression on the backend side).
- Visual brand matches the rest of the Olympic Paints stack — navy theme, brand yellow accent, Barlow / Barlow Condensed.
