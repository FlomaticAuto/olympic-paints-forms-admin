# Returns Intake — Accessible Light Themes

**Date:** 2026-05-21
**Author:** Quintus Lategan (via Claude)
**Status:** Spec — pending implementation plan
**Predecessor:** [`2026-05-21-returns-intake-tablet-landscape-design.md`](./2026-05-21-returns-intake-tablet-landscape-design.md)

---

## 1. Problem

The Returns Intake form (`/returns-intake`) currently ships in a single dark navy theme (`#0D2040` page, `#1A3D6E` panes, white text, yellow accents). It is used on warehouse tablets by older operators with mild low vision (reduced acuity + presbyopia + age-related contrast-sensitivity loss). Several signals indicate the dark theme is hard for these users to read in good warehouse lighting.

We need **light themes optimised for ageing eyes** without disturbing existing dark-mode users.

## 2. Goals

- Add a high-contrast Light theme that meets **WCAG 2.2 AAA** (≥7:1 body text contrast).
- Add a "Max legibility" theme (black on yellow) for users who need the absolute strongest contrast — modelled on road-sign convention familiar to older South African adults.
- Keep the existing Dark theme as the default; new themes are **opt-in** via a toggle.
- Persist user choice across sessions via `localStorage` (the existing pattern in the brand system).
- Make no functional changes to the form's behaviour, data model, validation, or submission flow.

## 3. Non-goals

- Not changing field structure, labels, copy, or submission payload.
- Not introducing the four-theme brand toggle (Light / Dark / Brand / Navy) from the global design system — this form gets its own scoped 3-option toggle (Dark / Light / Max) because Brand and Navy variants are not useful here.
- Not changing the dark theme. It stays exactly as it is.
- Not adding screen-reader / keyboard-navigation overhaul. That is a separate accessibility workstream.
- Not changing the tablet-landscape 3-pane layout from the predecessor spec.

## 4. Research summary

For older users with mild low vision in warehouse light:

| Finding | Implication for design |
|---|---|
| WCAG AAA = 7:1 body, 4.5:1 large text | Target tier; AA is insufficient |
| Pure `#FFFFFF` causes glare on tablets in fluorescent light | Use warm off-white `#FAFAF7` for the page surface |
| Brand yellow `#F5C400` on white = ~1.7:1 (fails) | Yellow can NOT be used as a text/accent colour on a white surface |
| Black on yellow = ~13:1 (passes AAA) | Yellow becomes the **selected-state surface** with black text — road-sign pattern |
| Ageing lens yellows → blues look duller | Avoid pale blue for any meaningful information; deep blue (`#0046B8`) is fine and tests at 8.5:1 |
| UI component borders need ≥3:1 (WCAG 2.1) | Pane/input borders go from `#E8E7E2` hairline to `#5C5B58` 2px |
| Don't rely on colour alone | Selected state adds a 2px black border + ✓ glyph, not just a colour swap |
| Type size for 60+ on tablets | Bump base 14→18px, inputs 16→20px, qty/KPI 22→32px |
| Tap targets | 44→52px (Apple HIG min 44; UK GDS recommends 48; we go 52 for tablet+gloves) |

Sources reviewed: WebAbility WCAG guide 2026, Perkins School for the Blind low-vision colour scheme guide, ConcreteCMS inclusive palettes article, WCAG Pros AA vs AAA guide.

## 5. Design

### 5.1 Theme toggle (added to header)

A new 3-button control in the form header, right of the meta block. Buttons are 44px high, Barlow Condensed, weight 700, 11px uppercase. Active button has filled background; inactive has 1px border. The control sets a class on `<form class="ri-form theme-X">` (scoped to the form, not `<html>`, to avoid touching the host page).

```
┌─────────────────────────────────────────────┐
│ [LOGO] RETURNS INTAKE   DATE  REF   │ DARK │ LIGHT │ MAX │
└─────────────────────────────────────────────┘
```

- **Dark** (`theme-dark`) — current behaviour, **default**.
- **Light** (`theme-light`) — new accessible white-pane theme.
- **Max** (`theme-max`) — new black-on-yellow maximum-contrast theme.

Persistence: `localStorage.setItem('returns-intake-theme', '<theme-name>')`. The initial theme is read from localStorage inside `useState`'s lazy initializer so it's set on the first render of the client component (the component is already `'use client'` — see line 1 of `ReturnIntakeForm.tsx`). Default `theme-dark` if absent or if `window` is unavailable during SSR. A brief flash is possible only on slow first-paint after hard reload; this is acceptable because the form is a long-running tablet session, not a navigated page. If FOUC is observed in QA, add a `<Script strategy="beforeInteractive">` in `src/app/returns-intake/page.tsx` that pre-applies the class to the document body.

### 5.2 Light theme palette

```css
.ri-form.theme-light {
  --r-page:           #FAFAF7;  /* warm off-white, anti-glare */
  --r-pane:           #FFFFFF;  /* card surface */
  --r-pane-sunken:    #F0EFEA;  /* step bg, zebra */
  --r-text:           #0A0A08;  /* near-black body, 19:1 on page */
  --r-text-muted:     #3D3D3A;  /* 11.5:1 — meta/secondary, still AAA */
  --r-text-dim:       #5C5B58;  /* 7.2:1 — labels only, just above AAA */
  --r-border:         #5C5B58;  /* 4.7:1 — visible card edges, 2px */
  --r-border-soft:    #B0AFAB;  /* 3.1:1 — secondary dividers */
  --r-accent:         #F5C400;  /* yellow — used as selected-bg only */
  --r-accent-text-on: #0A0A08;  /* near-black on yellow, 13:1 */
  --r-accent-border:  #6A5000;  /* yellow-900 — frames selected pills */
  --r-link:           #0046B8;  /* deep blue, 8.5:1 — focus rings, links */
  --r-danger-fg:      #B00020;  /* deep red, 8:1 on white */
  --r-danger-bg:      #FCE8EC;
  --r-danger-bd:      #B00020;
  --r-success-fg:     #1A5C50;  /* deep teal, 7.5:1 on white */
}
```

Component changes vs dark theme:

- `.ri-btn` background `--r-pane`, border 2px `--r-border`, text `--r-text`. Hover: background `--r-pane-sunken`.
- `.ri-btn.is-active` background `--r-accent` (yellow), text `--r-accent-text-on` (black), border 2px `--r-accent-border`, prepends `✓ ` via a `::before` pseudo-element.
- `.ri-step-value` text colour `--r-text` (not yellow).
- `.ri-step-label` colour `--r-text` (not yellow); the subtle "Step 1 / Step 2" hierarchy is conveyed by font-weight (900 for active step, 700 for done, dimmed `--r-text-muted` for upcoming) rather than colour.
- Focus ring: 3px solid `--r-link`, 3px offset (replaces yellow ring, which would be invisible on yellow selected state).
- Colour swatch grid: selected swatch keeps its colour fill but gets a 4px black `--r-text` ring + ✓ glyph overlay (top-right corner, 20×20 px white circle with black tick) — never colour-only.
- Required-field marker: red `*` plus the word "required" in red beside the label.

### 5.3 Max theme palette

```css
.ri-form.theme-max {
  --r-page:           #F5C400;  /* yellow page surface */
  --r-pane:           #FFFFFF;  /* white card on yellow */
  --r-pane-sunken:    #FAE04D;  /* lighter yellow */
  --r-text:           #000000;  /* pure black, ~21:1 on white pane, 13:1 on yellow */
  --r-text-muted:     #2E2E2C;  /* 14:1 */
  --r-text-dim:       #5C5B58;  /* 7.2:1 on white only — use sparingly */
  --r-border:         #000000;  /* 21:1 — pure black 2px borders */
  --r-border-soft:    #5C5B58;
  --r-accent:         #000000;  /* selected = black bg, yellow text */
  --r-accent-text-on: #F5C400;
  --r-accent-border:  #000000;
  --r-link:           #0046B8;  /* deep blue still works */
  --r-danger-fg:      #B00020;
  --r-danger-bg:      #FFFFFF;
  --r-danger-bd:      #B00020;
  --r-success-fg:     #1A5C50;
}
```

This inverts the yellow-vs-text relationship from Light: the page itself is yellow, panes are white, selected state becomes black-on-yellow text inside a black-filled button. Highest possible contrast in any lighting. Visually loud — that is the point.

### 5.4 Typography & sizing scale (applies to both new themes)

| Element | Current (dark) | New (light + max) |
|---|---|---|
| `.ri-wrap` body base | 14px | **18px** |
| `.ri-btn` | 12px | **16px** |
| `.ri-btn-wide` | 13px | **18px** |
| `.ri-swatch` | 11px | **14px** |
| `.ri-step-value` | 22px | **32px** |
| `.ri-step-btn` (qty +/-) | 22px | **28px** |
| `h1` (header) | 22px | **28px** |
| `.ri-step-label` | 11px | **13px** |
| `.ri-eyebrow` | 10px | **12px** |
| `.ri-meta-label` | 9px | **11px** |
| `.ri-meta-val` | 16px | **20px** |
| `min-height` on tappables | 44px | **52px** |
| Input/button border | 1px | **2px** |

Dark theme keeps its current sizes (no regression for night-shift users). The size bumps live inside the `.theme-light` and `.theme-max` scopes only.

### 5.5 Non-colour cues (applies to both new themes)

- **Selected state:** always shows ✓ glyph + thick border, never colour-only.
- **Required fields:** `*` + the word "required" in red, both visible.
- **Error states:** red border (2px), red `⚠` icon, red text — three reinforcing cues.
- **Disabled state:** 60% opacity + diagonal hatch pattern background (so it's distinguishable from "low contrast" rather than just "faded").

### 5.6 Files affected

| File | Change |
|---|---|
| `src/components/ReturnIntakeForm.tsx` | Add theme state + toggle UI; scope all CSS variables under `.ri-form.theme-*`; bump type sizes inside light/max scopes; add ✓ glyph on `.is-active`; required-field marker text; localStorage read/write |
| (none other) | No data model, no API, no other component changes |

The CSS already lives inside a template literal in this file (lines 379+). All changes are localised to that block plus a small JSX addition for the 3-button toggle and a `useEffect` for the persistence read.

## 6. Verification

The implementation plan must include these checks **before** the work is called done:

1. **Contrast verification (manual, screenshot-based):** open each theme in Chrome DevTools → use the colour-picker contrast readout on body text, labels, selected state, and the focus ring. Confirm AAA (≥7:1) on body, AA-large (≥3:1) on borders. Capture three screenshots.
2. **Tablet visual smoke test:** open the form on a tablet (or Chrome DevTools device mode at 1024×768), cycle through Dark → Light → Max, confirm no layout shift, all panes fit without scrolling, all tap targets ≥52px.
3. **Persistence test:** select Light, reload, confirm Light reloads without flash. Select Max, reload, confirm Max. Clear localStorage, confirm default reverts to Dark.
4. **No regression to Dark:** capture before/after screenshots of Dark theme to confirm zero visual drift.
5. **Form submission still works** in all three themes (one happy-path submission per theme).

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Yellow page in Max theme is visually loud; some users may dislike it | It's opt-in; default stays Dark. Document in commit message that Max is for the smallest subset of users. |
| Larger type breaks the 3-pane no-scroll layout on smaller tablets | Test at 1024×768 (the spec-stated tablet target). If a pane overflows, increase the form's max height by allowing the wrap padding to shrink in light/max themes. |
| Localstorage key collision with the global `oly-theme` key | Use a distinct key: `returns-intake-theme`. The form's theme is form-scoped, not page-scoped. |
| FOUC (flash of dark theme before light loads) on user with Light saved | Inline `<script>` in the form's root reads localStorage and sets the class before first paint, mirroring the global pattern. |

## 8. Out of scope (explicitly deferred)

- Adding the Light/Max themes to *other* forms in this repo (returns-intake only for now; if it works, extend to merchandising and CI verification forms in a follow-up).
- Screen-reader testing / ARIA improvements.
- Keyboard-navigation overhaul.
- Adding a "Brand" or "Navy" variant — those exist in the global design system but aren't useful for a warehouse intake form.

---

## Open questions

None at spec-approval time. Implementation plan should still confirm:
- Exact icon for ✓ glyph (Unicode `✓` U+2713 vs an inline SVG check) — implementer's call, both work.
- Whether to add a one-time toast on first Light/Max selection ("Theme saved — you can switch back any time from the header"). Recommendation: yes, simple text toast, dismisses on click.
