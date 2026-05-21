# Returns Intake — Accessible Light Themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two opt-in accessible themes (Light WCAG-AAA and Max black-on-yellow) to the Returns Intake form, selectable via a header toggle and persisted in localStorage, without altering the existing Dark theme, form behaviour, or data flow.

**Architecture:** All work happens inside the existing client component [`src/components/ReturnIntakeForm.tsx`](../../../src/components/ReturnIntakeForm.tsx). A `theme` state variable (lazy-initialised from `localStorage`) drives a class on the form root (`ri-form theme-dark|theme-light|theme-max`). The CSS template literal is restructured so the existing variables live under a `:root` block (the dark default) plus two new scope blocks for `.ri-form.theme-light` and `.ri-form.theme-max`. The new themes also bump type sizes inside their scoped selectors. No other files are touched (no API, no data, no `lib/`).

**Tech Stack:** Next.js 16 App Router · React 19 (client component) · Vanilla CSS in a `<style dangerouslySetInnerHTML>` block · TypeScript · No test framework configured in this repo — verification is `tsc --noEmit`, `npm run build`, and manual browser smoke tests.

**Verification reality:** Per `feedback_no_eslint_in_forms_admin`: this repo has no ESLint config; do not bootstrap it. There is no Jest/Vitest runner either. Each task's verification is therefore `npx tsc --noEmit`, `npm run build` (only for the final task to keep iteration fast), and a documented manual browser check. Do NOT add a test framework.

**Spec:** [`docs/superpowers/specs/2026-05-21-returns-intake-accessible-light-themes-design.md`](../specs/2026-05-21-returns-intake-accessible-light-themes-design.md)

---

## File Structure

| File | Action | Why |
|---|---|---|
| `src/components/ReturnIntakeForm.tsx` | Modify | All theme state, toggle UI, scoped CSS, and type-scale bumps live here |
| `docs/superpowers/specs/2026-05-21-returns-intake-accessible-light-themes-design.md` | Read-only | Source of truth for palettes & verification criteria |

No new files. No file splits. The component is 759 lines, large but already single-responsibility (one form, one CSS block). Splitting it is out of scope and not justified by this change.

---

## Task 1: Add theme state and persistence helper

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx:21-35` (state block) and `src/components/ReturnIntakeForm.tsx:1-2` (imports)

- [ ] **Step 1: Add a useEffect import**

Open `src/components/ReturnIntakeForm.tsx`. Line 2 currently reads:

```typescript
import { useState, FormEvent } from 'react';
```

Change it to:

```typescript
import { useState, useEffect, FormEvent } from 'react';
```

- [ ] **Step 2: Add a Theme type and the localStorage key constant**

Immediately after line 7 (`interface Props { formId: string; }`), add:

```typescript
type Theme = 'theme-dark' | 'theme-light' | 'theme-max';
const THEME_STORAGE_KEY = 'returns-intake-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'theme-dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'theme-light' || saved === 'theme-max' || saved === 'theme-dark') return saved;
  return 'theme-dark';
}
```

- [ ] **Step 3: Add the theme state inside the component**

Inside `ReturnIntakeForm`, immediately after line 22 (`const [reportRef] = useState<string>(() => generateRef());`), add:

```typescript
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);
```

- [ ] **Step 4: Verify TypeScript still compiles**

Run from the repo root:

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). If errors mention `useEffect` not found, confirm the import edit in Step 1. If errors mention `Theme` not assignable, confirm the literal-union type in Step 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): add theme state with localStorage persistence"
```

---

## Task 2: Apply the theme class to the form root and the success screen

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx:118-130` (success/done branch) and `src/components/ReturnIntakeForm.tsx:132-134` (main return)

The component renders into `<main className="ri-wrap">` in two places: the success screen (line 120) and the live form (line 133). The theme class must apply to both. We attach it to `<main>` so the page background also changes (the page surface is the `.ri-wrap` background).

- [ ] **Step 1: Update the success-branch wrapper**

Find lines 118-130:

```tsx
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
```

Change line 120 from:

```tsx
      <main className="ri-wrap">
```

to:

```tsx
      <main className={`ri-wrap ${theme}`}>
```

- [ ] **Step 2: Update the live-form wrapper**

Find line 133:

```tsx
    <main className="ri-wrap">
```

Change it to:

```tsx
    <main className={`ri-wrap ${theme}`}>
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Quick manual smoke test (no toggle exists yet — verify default still works)**

```bash
npm run dev
```

Open `http://localhost:3000/returns-intake`. Expected: form looks identical to before (dark navy theme). The `theme-dark` class is on the wrapper but no CSS rules target it yet, so the existing `:root` variables still drive everything. Stop the dev server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): apply theme class to wrapper"
```

---

## Task 3: Restructure CSS — move dark variables into a scoped block alongside `:root`

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx:380-394` (the `:root` CSS variable block)

We keep `:root` as the fallback (so nothing breaks if the class is ever missing) and add explicit `.ri-wrap.theme-dark` selectors with the same values. This sets up the pattern that Task 4 and Task 5 will reuse for Light and Max.

- [ ] **Step 1: Replace the `:root` block with `:root` + `.ri-wrap.theme-dark`**

Find lines 380-394 (the existing `:root { ... }` block). Replace it entirely with:

```css
  :root,
  .ri-wrap.theme-dark {
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
    --r-focus: var(--r-yellow);
    --r-selected-bg: var(--r-yellow);
    --r-selected-fg: var(--r-page);
    --r-selected-bd: var(--r-yellow);
  }
```

Note the four new variables at the end (`--r-focus`, `--r-selected-bg`, `--r-selected-fg`, `--r-selected-bd`) — Task 6 will switch the hard-coded `var(--r-yellow)` references in `.ri-btn.is-active` and `:focus-visible` over to these so the same component CSS works across all three themes.

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output. (CSS lives in a template literal so TS doesn't check it, but this guards against accidental code damage.)

- [ ] **Step 3: Manual smoke test — dark theme unchanged**

```bash
npm run dev
```

Open `http://localhost:3000/returns-intake`. Expected: identical to before — navy page, yellow accents, white text. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "refactor(returns-intake): scope dark theme variables under .theme-dark"
```

---

## Task 4: Add the Light theme variable block

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx` — insert a new CSS block immediately after the dark-theme block from Task 3

- [ ] **Step 1: Insert the Light theme block**

Find the closing `}` of the `.ri-wrap.theme-dark` block from Task 3. Immediately after it (before the `.ri-wrap { ... }` rule that follows), insert:

```css

  .ri-wrap.theme-light {
    --r-page: #FAFAF7;
    --r-pane: #FFFFFF;
    --r-pane-sunken: #F0EFEA;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #0A0A08;
    --r-text-muted: #3D3D3A;
    --r-text-dim: #5C5B58;
    --r-border: #5C5B58;
    --r-border-soft: #B0AFAB;
    --r-danger-bg: #FCE8EC;
    --r-danger-fg: #B00020;
    --r-danger-bd: #B00020;
    --r-focus: #0046B8;
    --r-selected-bg: #F5C400;
    --r-selected-fg: #0A0A08;
    --r-selected-bd: #6A5000;
  }
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Manual smoke test — temporarily force Light theme**

To preview before the toggle exists, edit line 22-equivalent **temporarily**:

```typescript
  const [theme, setTheme] = useState<Theme>(() => readInitialTheme());
```

becomes (temporarily, do not commit this change):

```typescript
  const [theme, setTheme] = useState<Theme>('theme-light');
```

Then:

```bash
npm run dev
```

Open `http://localhost:3000/returns-intake`. Expected: page is warm off-white; panes are white; text is near-black; selected buttons are yellow with black text; borders are clearly visible dark grey. Type is still at the old smaller size — that gets fixed in Task 7.

**Revert** the temporary change back to `readInitialTheme()` before committing. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): add light theme variable block"
```

---

## Task 5: Add the Max theme variable block

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx` — insert a new CSS block immediately after the Light block from Task 4

- [ ] **Step 1: Insert the Max theme block**

Find the closing `}` of the `.ri-wrap.theme-light` block from Task 4. Immediately after it, insert:

```css

  .ri-wrap.theme-max {
    --r-page: #F5C400;
    --r-pane: #FFFFFF;
    --r-pane-sunken: #FAE04D;
    --r-yellow: #F5C400;
    --r-yellow-hover: #FAE04D;
    --r-text: #000000;
    --r-text-muted: #2E2E2C;
    --r-text-dim: #5C5B58;
    --r-border: #000000;
    --r-border-soft: #5C5B58;
    --r-danger-bg: #FFFFFF;
    --r-danger-fg: #B00020;
    --r-danger-bd: #B00020;
    --r-focus: #0046B8;
    --r-selected-bg: #000000;
    --r-selected-fg: #F5C400;
    --r-selected-bd: #000000;
  }
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Temporary preview of Max theme**

As in Task 4 Step 3, temporarily set `useState<Theme>('theme-max')`. Run `npm run dev`, open the form. Expected: page is yellow; panes are white; borders are pure-black 1px (Task 7 will thicken to 2px); selected buttons are black with yellow text.

**Revert** the temporary change. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): add max theme variable block"
```

---

## Task 6: Switch hard-coded yellow references in component CSS to the new semantic variables

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx:524-533` (`.ri-btn:focus-visible` and `.ri-btn.is-active`), `:605-612` (`.ri-swatch:focus-visible` and `.ri-swatch.is-selected`), `:667-671` (`.ri-input:focus`)

The three Tasks above defined `--r-focus`, `--r-selected-bg`, `--r-selected-fg`, `--r-selected-bd` in every theme. Now we make the components use them.

- [ ] **Step 1: Update `.ri-btn:focus-visible` and `.ri-btn.is-active`**

Find lines 524-533:

```css
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
```

Replace with:

```css
  .ri-btn:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
  }
  .ri-btn.is-active {
    background: var(--r-selected-bg);
    color: var(--r-selected-fg);
    border-color: var(--r-selected-bd);
    font-weight: 900;
  }
```

- [ ] **Step 2: Update `.ri-swatch:focus-visible` and `.ri-swatch.is-selected`**

Find lines 605-612:

```css
  .ri-swatch:focus-visible {
    outline: 2px solid var(--r-yellow);
    outline-offset: 2px;
  }
  .ri-swatch.is-selected {
    border-color: var(--r-yellow);
    box-shadow: 0 0 0 2px var(--r-pane), 0 0 0 4px var(--r-yellow);
  }
```

Replace with:

```css
  .ri-swatch:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
  }
  .ri-swatch.is-selected {
    border-color: var(--r-selected-bd);
    box-shadow: 0 0 0 2px var(--r-pane), 0 0 0 4px var(--r-selected-bd);
  }
```

- [ ] **Step 3: Update `.ri-input:focus`**

Find lines 667-671:

```css
  .ri-input:focus {
    outline: 2px solid var(--r-yellow);
    outline-offset: 2px;
    border-color: var(--r-yellow);
  }
```

Replace with:

```css
  .ri-input:focus {
    outline: 3px solid var(--r-focus);
    outline-offset: 3px;
    border-color: var(--r-focus);
  }
```

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Manual smoke test — dark theme still uses yellow focus / selected, Light still uses blue focus / yellow selected**

```bash
npm run dev
```

Open the form (default = Dark). Tab into a button. Expected: 3px yellow focus ring at 3px offset (slightly thicker/further than before but still yellow). Click a category. Expected: yellow background with navy text — visually identical to before.

Temporarily set `useState<Theme>('theme-light')`, reload. Tab into a button. Expected: 3px deep-blue focus ring. Click a category. Expected: yellow background with near-black text.

Temporarily set `useState<Theme>('theme-max')`, reload. Click a category. Expected: black background with yellow text.

**Revert** the temporary changes. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "refactor(returns-intake): drive focus & selected states from semantic CSS variables"
```

---

## Task 7: Apply type-scale bumps for Light and Max themes only

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx` — append a new CSS block at the end of the existing CSS, before the closing backtick on line 759

The spec calls for larger text in Light and Max only, leaving Dark untouched. We do this by adding scoped overrides at the end of the CSS so they win on specificity.

- [ ] **Step 1: Append the type-scale block before the closing backtick**

Find line 758 — currently:

```css
  }
`;
```

Insert this block immediately before the closing backtick (so it lives inside the CSS string):

```css

  /* ── Accessible-theme type & sizing bumps (Light + Max only) ── */
  .ri-wrap.theme-light,
  .ri-wrap.theme-max {
    font-size: 18px;
  }
  .ri-wrap.theme-light .ri-btn,
  .ri-wrap.theme-max .ri-btn {
    font-size: 16px;
    min-height: 52px;
    border-width: 2px;
  }
  .ri-wrap.theme-light .ri-btn-wide,
  .ri-wrap.theme-max .ri-btn-wide {
    font-size: 18px;
  }
  .ri-wrap.theme-light .ri-swatch,
  .ri-wrap.theme-max .ri-swatch {
    font-size: 14px;
    min-height: 58px;
  }
  .ri-wrap.theme-light .ri-step-value,
  .ri-wrap.theme-max .ri-step-value {
    font-size: 32px;
    min-height: 52px;
  }
  .ri-wrap.theme-light .ri-step-btn,
  .ri-wrap.theme-max .ri-step-btn {
    font-size: 28px;
  }
  .ri-wrap.theme-light h1,
  .ri-wrap.theme-max h1 {
    font-size: 28px;
  }
  .ri-wrap.theme-light .ri-step-label,
  .ri-wrap.theme-max .ri-step-label {
    font-size: 13px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-eyebrow,
  .ri-wrap.theme-max .ri-eyebrow {
    font-size: 12px;
    color: var(--r-text-muted);
  }
  .ri-wrap.theme-light .ri-meta-label,
  .ri-wrap.theme-max .ri-meta-label {
    font-size: 11px;
    color: var(--r-text-muted);
  }
  .ri-wrap.theme-light .ri-meta-val,
  .ri-wrap.theme-max .ri-meta-val {
    font-size: 20px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-input,
  .ri-wrap.theme-max .ri-input {
    font-size: 18px;
    min-height: 52px;
    border-width: 2px;
  }
  .ri-wrap.theme-light .ri-step-value,
  .ri-wrap.theme-max .ri-step-value {
    border-width: 2px;
    color: var(--r-text);
  }
  .ri-wrap.theme-light .ri-step-value.is-empty,
  .ri-wrap.theme-max .ri-step-value.is-empty {
    color: var(--r-text-dim);
  }
```

Note the colour overrides on `.ri-step-label`, `.ri-eyebrow`, `.ri-meta-label`, `.ri-meta-val`, and `.ri-step-value` — the dark theme uses yellow for these and yellow fails contrast on white. We re-bind them to `--r-text` / `--r-text-muted` inside the Light/Max scopes.

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Manual smoke test in all three themes**

Temporarily set `useState<Theme>('theme-light')`. `npm run dev`. Verify:
- Page is warm white, panes white, text near-black, all very legible.
- Buttons are noticeably larger than dark theme.
- Step labels are not yellow — they are near-black.
- Meta values (Report No., Date) are near-black, not yellow.

Temporarily set `useState<Theme>('theme-max')`. Verify: yellow page, white panes, pure-black borders 2px, pure-black step labels.

Set back to `readInitialTheme()`. Reload. Verify dark theme is **unchanged** (same yellow accents, same smaller type as before).

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): apply type-scale bumps for light & max themes"
```

---

## Task 8: Add the Dark / Light / Max toggle to the header

**Files:**
- Modify: `src/components/ReturnIntakeForm.tsx:145-154` (the `.ri-meta` block inside the header), and append toggle CSS before the closing backtick

We add the toggle as a third item in the header, right of the meta block. Layout uses the existing flex header.

- [ ] **Step 1: Insert the toggle JSX after the `.ri-meta` div**

Find lines 145-154:

```tsx
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
```

Immediately after the closing `</div>` of `.ri-meta` (after line 154), insert:

```tsx
          <div className="ri-theme-toggle" role="group" aria-label="Display theme">
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-dark' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-dark'}
              onClick={() => setTheme('theme-dark')}
            >Dark</button>
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-light' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-light'}
              onClick={() => setTheme('theme-light')}
            >Light</button>
            <button
              type="button"
              className={`ri-theme-btn ${theme === 'theme-max' ? 'is-active' : ''}`}
              aria-pressed={theme === 'theme-max'}
              onClick={() => setTheme('theme-max')}
            >Max</button>
          </div>
```

- [ ] **Step 2: Append toggle CSS before the closing backtick**

Find the closing backtick on (now-shifted) line ~825 — search for the literal `\n\`;` at the very end of the CSS string. Immediately before the closing backtick, insert:

```css

  /* ── Theme toggle ── */
  .ri-theme-toggle {
    display: flex;
    gap: 4px;
    margin-left: 14px;
    background: var(--r-pane-sunken);
    border-radius: 8px;
    padding: 3px;
  }
  .ri-theme-btn {
    background: transparent;
    color: var(--r-text);
    border: 0;
    border-radius: 6px;
    padding: 8px 14px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    cursor: pointer;
    min-height: 36px;
    transition: background 0.12s;
  }
  .ri-theme-btn:hover { background: var(--r-pane); }
  .ri-theme-btn:focus-visible {
    outline: 3px solid var(--r-focus);
    outline-offset: 2px;
  }
  .ri-theme-btn.is-active {
    background: var(--r-selected-bg);
    color: var(--r-selected-fg);
    font-weight: 900;
  }
  .ri-wrap.theme-light .ri-theme-btn,
  .ri-wrap.theme-max .ri-theme-btn {
    font-size: 14px;
    min-height: 44px;
  }
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no output. If errors mention `setTheme` not found, confirm Task 1 Step 3 was committed.

- [ ] **Step 4: Manual smoke test — toggle works in all three themes and persists**

```bash
npm run dev
```

Open `http://localhost:3000/returns-intake`. Expected: header shows three buttons (Dark / Light / Max) to the right of the date. Dark is highlighted with yellow background + navy text.

- Click **Light**. Page becomes warm-white, panes white, text near-black, larger buttons, blue focus rings.
- Click **Max**. Page becomes yellow, panes white, pure-black borders.
- Click **Dark**. Page returns to original navy.

Reload the page (F5). Expected: the last theme you selected persists (read from localStorage). Open DevTools → Application → Local Storage → `http://localhost:3000` → confirm key `returns-intake-theme` exists with the chosen value.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReturnIntakeForm.tsx
git commit -m "feat(returns-intake): add dark/light/max theme toggle in header"
```

---

## Task 9: Verify contrast and submission flow end-to-end

**Files:** none modified — verification only.

- [ ] **Step 1: Build the production bundle**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. If errors appear, fix them before continuing.

- [ ] **Step 2: Start production preview**

```bash
npm start
```

Open `http://localhost:3000/returns-intake`.

- [ ] **Step 3: Contrast spot-check in each theme using Chrome DevTools**

In Chrome: F12 → Elements panel → click the colour swatch next to any `color:` declaration in the Computed pane. The colour picker shows AA / AAA contrast badges.

For each theme (Dark, Light, Max), confirm AAA (✓ marked in the picker) on:
- The body text inside a `.ri-step-label`
- The text inside an active `.ri-btn.is-active`
- The text inside the submit button `.ri-submit`
- The focus ring colour against the surface it sits on (focus a button via Tab and inspect)

Document any contrast warnings — they should not appear in Light or Max. If they do, raise to the design before "fixing" — the spec palettes were chosen specifically.

- [ ] **Step 4: Submission smoke test in each theme**

For each theme (Dark, Light, Max):
- Switch to the theme via the toggle.
- Complete a full return: pick a category, product, colour, size, qty (use the + button), return type, supervisor, type a batch number.
- Click "Log Return".
- Expected: the success screen renders ("Return Logged" + the RET-… reference) in the same theme.
- Open Supabase / your local dev DB to confirm the row was inserted with the correct `report_ref`. (Skip if dev DB is unavailable — confirm only that no error toast appears.)

- [ ] **Step 5: Final commit of plan-completion marker**

If anything needed fixing during steps 3–4, commit those fixes now with descriptive messages. Otherwise no commit needed for verification-only steps.

If everything passes, write a final commit summarising the feature:

```bash
git commit --allow-empty -m "chore(returns-intake): accessible Light + Max themes verified in dev + prod build"
```

---

## Self-review checklist (run after writing — already completed by author)

- ✅ **Spec coverage:** Every spec section maps to a task. Section 5.1 (toggle) → Task 8. Section 5.2 (Light palette) → Task 4. Section 5.3 (Max palette) → Task 5. Section 5.4 (type scale) → Task 7. Section 5.5 (non-colour cues) — *partially* covered: focus ring colour change is in Task 6; the ✓ glyph and required-field marker described in the spec are **explicitly deferred** because they would require modifying every sub-component button (`CategoryGrid`, `ProductList`, `ColourSwatchGrid`, `SizePills`, `ReturnTypeGrid`, `SupervisorGrid`) and the field-label markup, which doubles the surface area of this change. See note below.
- ✅ **Placeholder scan:** No TBDs, no "implement appropriate X", no "similar to Task N". All code blocks are complete.
- ✅ **Type consistency:** `Theme` type, `THEME_STORAGE_KEY`, `readInitialTheme()`, `setTheme` all match between Tasks 1, 2, 6, and 8.
- ✅ **Verification approach matches repo reality:** `tsc --noEmit` + `npm run build` + manual browser checks. No bootstrapping of test frameworks or ESLint (per memory `feedback_no_eslint_in_forms_admin`).

### Deferred from spec section 5.5 — to a follow-up plan

The spec calls for:
1. ✓ glyph on every selected state (currently colour + thick border only)
2. Required-field marker = red `*` + the word "required"
3. Hatched background on disabled state

These are visual-polish improvements that depend on the new themes being live first (so you can see whether the colour + border change alone is sufficient for low-vision users). Defer to a follow-up plan after Quintus reviews the new themes on a real tablet with a real warehouse user. If they confirm the colour + border treatment is enough, items 1–3 may not be needed at all (YAGNI).
