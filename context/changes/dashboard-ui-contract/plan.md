# Dashboard UI design-system contract Implementation Plan

## Overview

Bring the dashboard (`DashboardPage` and its three components) onto the repo's own CSS-variable design system, and close the gaps in that system that the audit found: no on-accent / radius / ring / chart tokens, no shared focus and disabled states, a chart that ignores the theme, text-only loading, and a buried primary action. The change ends with a visual gate and a guard so the next agent keeps using the tokens.

## Current State Analysis

- Variant: **existing design system, plain CSS variables** (no Tailwind, no shadcn, no `components/ui`). Values: `frontend/src/index.css:1-50` (`:root` plus `prefers-color-scheme: dark`). Shared primitives are CSS classes in `frontend/src/styles/page.css` (`.btn-primary`, `.btn-secondary`, `.page-card`, `.field`, `.error-text`), used in 36 places outside the dashboard.
- Hard-coded scan on the dashboard view files: 0 hits. Only literal in the shared styles it depends on: `#fff` at `page.css:74`. Radius literal `8px` appears 18 times across `styles/*.css`.
- Contrast (computed): white on `#aa3bff` 4.39:1 (light), white on `#c084fc` 2.64:1 (dark). Recharts 3.10.1 defaults: axis line `#666` (`node_modules/recharts/es6/cartesian/CartesianAxis.js:61`), tooltip `#fff` background and `#ccc` border (`DefaultTooltipContent.js:34-35`).
- `focus-visible` styled only for `.field input`, `.history-filter select`, `.workout-select`; `.btn-secondary:disabled` only as `.history-pager .btn-secondary:disabled` (`history.css:91`).
- Dashboard route is behind `RequireAuth` (redirects logged-out users to `/login`), so charge category 3 has no auth gap.
- Tooling in repo: Playwright (`frontend/e2e/`, Chromium, no screenshot tests yet), `oxlint`, `vitest`. Agent rules file: `CLAUDE.md` (no UI section, no `BEGIN/END @przeprogramowani/10x-cli` block present).

Full evidence: `context/changes/dashboard-ui-contract/research.md` (`## Charges`).

## Desired End State

On `/` the dashboard reads every colour, radius and focus colour from tokens in both themes; text on accent buttons is at least 4.5:1; "Start workout" is the first thing under the title; loading shows skeleton blocks of the final size (no layout jump); buttons and links show a tokenised focus ring and disabled buttons look disabled; the weekly chart axes and tooltip follow the theme. A Playwright spec captures the dashboard (desktop and 375px, light and dark) plus assertions for the 7 states, `CLAUDE.md` carries the UI rule, and `npm run check:tokens` fails on literals in the cleaned files.

### Key Discoveries:

- `.btn-primary` / `.btn-secondary` are global, so Phase 2 changes every page's buttons (intended; needs a quick look at other pages).
- `MuscleGroupStatsPage.tsx:8` imports `dashboard.css` and uses `.muscle-*` from it; moving those rules needs a new import there.
- `ProgressionChart.tsx:71-85` repeats the chart pattern; one shared helper fixes both.
- `ConsistencyCard.tsx:27,31` borrows tile classes; `.consistency-label input` (`dashboard.css:144`) is outside `.field`, so it gets no input styles.
- Existing e2e specs click "Start workout" by role (`log-set.spec.ts`, `progression-recommendation.spec.ts`, `muscle-group-stats.spec.ts` touch the dashboard), so moving it must keep those green.

## What We're NOT Doing

- No rebrand, no other view's layout, no `shadcn init`, no new dependency (no stylelint, no Storybook).
- No change to `topbar.css` (its `rgba(0,0,0,.5)` overlay) or to the `8px` literals in other stylesheets (`history.css`, `workout.css`, `plans.css`, `exercises.css`). Deferred, recorded in `research.md` `## Charges`.
- No dark-mode toggle (the app follows `prefers-color-scheme` only).
- No sticky bottom CTA bar; no change to API or i18n keys except one hidden loading label reuse.
- Not a WCAG audit: contrast is checked for the changed tokens only.

## Implementation Approach

Order is fixed by the `/10x-ui` contract: token values, then shared states, then the one view, then the 7-state matrix, gate and guard. Everything is expressed as CSS variables on `:root` so the dark override continues to work (aliases like `--chart-tick: var(--text)` resolve per theme). Raw values and their source are written to `context/changes/dashboard-ui-contract/tokens.md` as well, so the next session does not re-invent them.

Decided in planning:

- **Accent:** light `--accent` darkened to about `#9d2ff5` (white text 5.05:1) with `--on-accent: #fff`; dark keeps `--accent: #c084fc` with `--on-accent: #16171d` (6.77:1). `--accent-bg` / `--accent-border` rgba values follow the new light accent.
- **CTA:** "Start workout" moves directly under the title, before the window toggle (the toggle belongs to the stats below it); "Muscle stats" stays at the bottom.
- **Loading:** token-based skeleton blocks sized like tiles and the 220px chart.
- **Focus / disabled:** global `--ring`, applied to the shared classes in `page.css`.
- **Gate:** Playwright `toHaveScreenshot` plus state assertions, `CLAUDE.md` rule, and a Node script as the hard-coded-value check.

## Phase 1: Token values

### Overview

Add the missing tokens and make the shared styles use them. Covers charges 1 (token half) and 2.

### Changes Required:

#### 1. Token source

**File**: `frontend/src/index.css`

**Intent**: Add `--on-accent`, `--radius`, `--ring`, and chart aliases; adjust the light `--accent` family for 4.5:1 text contrast; give dark values where they differ.

**Contract**: New `:root` variables: `--on-accent`, `--radius` (8px), `--radius-card` (12px), `--ring` (focus colour, theme-specific), `--chart-tick` (= `--text`), `--chart-grid` (= `--border`), `--chart-tooltip-bg` (= `--bg`), `--chart-tooltip-border` (= `--border`), `--chart-bar` (= `--accent`). Light `--accent` about `#9d2ff5`, `--accent-bg` / `--accent-border` recomputed from it. Dark block overrides `--on-accent`, `--ring`. Add one comment line above the block naming `tokens.md` as the record of values.

#### 2. Shared styles use the tokens

**Files**: `frontend/src/styles/page.css`, `frontend/src/styles/dashboard.css`

**Intent**: Replace `#fff` (`page.css:74`) with `var(--on-accent)` and the `8px` / `12px` radius literals in these two files with `--radius` / `--radius-card`. Other stylesheets stay as they are.

**Contract**: No class renames; no visual change except the accent shade and button text colour.

#### 3. Value record

**File**: `context/changes/dashboard-ui-contract/tokens.md`

**Intent**: Raw values per theme, computed contrast ratios, and the line "values live in `frontend/src/index.css`".

### Success Criteria:

#### Automated Verification:

- Build and type check pass: `npm run build` (in `frontend/`)
- Lint passes: `npm run lint`
- No `#fff` left in `page.css`: `grep -n "#fff" frontend/src/styles/page.css` returns nothing
- Contrast of `--on-accent` on `--accent` is at least 4.5:1 in both themes (computed in `tokens.md`)

#### Manual Verification:

- Login page and one other page (e.g. History) look unchanged apart from the slightly deeper purple in light mode
- Dark mode (OS setting) shows dark text on the lighter purple button

---

## Phase 2: Shared button and input states

### Overview

One contract for focus-visible, disabled and hover on shared classes. Covers charge 3.

### Changes Required:

#### 1. Button and link states

**File**: `frontend/src/styles/page.css`

**Intent**: Add a `--ring` outline (with offset) for `:focus-visible` on `.btn-primary`, `.btn-secondary` and `.page-switch a`; a visible `:disabled` look for `.btn-secondary` (same pattern as `.btn-primary:disabled`) with no hover change while disabled; a hover that is token-driven for the pressed/unpressed toggle.

**Contract**: Selectors `.btn-primary:focus-visible`, `.btn-secondary:focus-visible`, `.btn-secondary:disabled`, `.btn-secondary:hover:not(:disabled)`. The pager-scoped rule at `history.css:91` is left alone (harmless duplicate).

#### 2. Goal input

**File**: `frontend/src/styles/page.css` (selector list) or `dashboard.css`

**Intent**: Give `.consistency-label input` the same border, background, focus and disabled treatment as `.field input`, so the goal field is not an unstyled native input.

**Contract**: Extend the `.field input` rule set to also match `.consistency-label input`; add `.field input:disabled` / `.consistency-label input:disabled` look (reduced opacity, default cursor).

### Success Criteria:

#### Automated Verification:

- Build and lint pass: `npm run build && npm run lint`
- Existing e2e specs still pass: `npm run test:e2e`

#### Manual Verification:

- Tabbing through the dashboard shows the ring on the toggle, Save/Clear, and both bottom links
- Save and Clear look disabled while saving or with an empty/invalid goal
- Spot-check History and Plans pages: buttons look consistent, no regressions

---

## Phase 3: Dashboard view

### Overview

Make the view itself consume the contract. Covers charges 1, 4 and 5.

### Changes Required:

#### 1. Chart theme helper

**Files**: new `frontend/src/components/chartTheme.ts`, `frontend/src/components/WeeklyVolumeChart.tsx`, `frontend/src/components/ProgressionChart.tsx`

**Intent**: One place that maps Recharts props (axis tick fill, axis line stroke, grid, tooltip content/label/item styles, bar/line colour) to the `--chart-*` tokens; both charts use it.

**Contract**: Exports prop objects such as `axisProps` and `tooltipProps` (spread onto `XAxis`/`YAxis`/`Tooltip`) that reference `var(--chart-*)` strings only; no literal colours.

#### 2. Page layout and skeleton

**File**: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/styles/dashboard.css`

**Intent**: Move the "Start workout" link directly under `<h1>`; replace the two loading `<p>` texts (`:153`, `:192`) with skeleton blocks the same size as the loaded content (three tiles; a 220px chart block plus two card blocks), animated with a pulse that is disabled under `prefers-reduced-motion`. Keep an accessible loading message (visually hidden text in a `role="status"` region) and the existing `aria-live` wrapper.

**Contract**: New classes `.skeleton`, `.skeleton-tile`, `.skeleton-chart`, `.visually-hidden`, coloured from `--accent-bg` / `--border` and rounded with `--radius`. The `dashboard.loading` and `dashboard.insightsLoading` i18n keys are reused as the hidden text. Spacing of `.dashboard-start` adjusted so the primary link sits above the toggle with the toggle's bottom margin unchanged.

#### 3. Shared card and stat classes

**Files**: `frontend/src/styles/page.css`, `dashboard.css`, `DashboardPage.tsx`, `RecentRecords.tsx`, `ConsistencyCard.tsx`

**Intent**: Define one `.card` surface (border, `--radius`, `--border`) used by tiles and record rows, and neutral `.stat-label` / `.stat-value` classes used by tiles and the consistency summary, replacing the cross-component use of `dashboard-tile-*`.

**Contract**: Class renames `dashboard-tile-label|value` to `stat-label|value`; `.dashboard-tile` and `.recent-records li` add `.card` and drop their own border/radius. Check that no e2e spec or test selects the old class names.

#### 4. Move muscle styles

**Files**: `frontend/src/styles/dashboard.css`, new `frontend/src/styles/muscle-groups.css`, `frontend/src/pages/MuscleGroupStatsPage.tsx`

**Intent**: Move `.muscle-*` (`dashboard.css:155-199`) to their own file and import it in `MuscleGroupStatsPage`, so the dashboard stylesheet describes only the dashboard.

**Contract**: Rules moved verbatim apart from tokenising literals; `MuscleGroupStatsPage` keeps its `dashboard.css` import only if it still uses `.dashboard-card` / `.dashboard-toggle`.

### Success Criteria:

#### Automated Verification:

- Build, lint and unit tests pass: `npm run build && npm run lint && npm test`
- Hard-coded scan on the dashboard view files returns 0 hits (see the scan command in the skill, run on `DashboardPage.tsx`, `dashboard.css`, `ConsistencyCard.tsx`, `RecentRecords.tsx`, `WeeklyVolumeChart.tsx`, `chartTheme.ts`)
- Existing e2e specs pass, including `muscle-group-stats.spec.ts`: `npm run test:e2e`

#### Manual Verification:

- Dark mode: chart axis labels and tooltip follow the theme
- Slow network (devtools throttling): skeleton appears and the page does not jump when data arrives
- "Start workout" is visible without scrolling on a 375px-wide screen
- History page progression chart looks right in both themes
- Muscle stats page still looks as before

---

## Phase 4: 7-state matrix, visual gate and guard

### Overview

Prove the states, gate the view with screenshots, and leave the rule and check. Covers charge 5 (guard) and the Definition of Done.

### Changes Required:

#### 1. Dashboard visual and state spec

**File**: new `frontend/e2e/dashboard-ui.spec.ts`

**Intent**: Register a user via API (see `e2e/helpers.ts`), seed one finished workout with a personal record so the full dashboard renders, and cover the 7 states:

- default: `toHaveScreenshot` for desktop and 375px, each in light and dark (`page.emulateMedia({ colorScheme })`), masking date text and chart; `maxDiffPixels` kept small
- hover: assert the hovered secondary button's border colour differs from rest
- focus-visible: tab to the primary link and assert a non-default outline colour equal to `--ring`
- disabled: Save is disabled with an empty goal and computed opacity below 1
- error: route-fail the insights request and assert the alert is visible with the `--danger` colour
- empty: fresh user shows the empty-state text, not a blank frame
- loading: delay the stats request and assert skeleton visible, then compare the container height before and after load

**Contract**: First baselines are created deliberately with `--update-snapshots` and reviewed by eye; baselines are never refreshed later without an explained visual delta. Baselines are platform-specific by Playwright default (generated on Windows here); note this in the spec header.

#### 2. Agent rule

**File**: `CLAUDE.md`

**Intent**: Add a short `## UI conventions` section (outside any generated CLI block): tokens in `frontend/src/index.css`; shared classes in `frontend/src/styles/page.css` (check before adding a new button/card/field style); no literal colours, radii or arbitrary values in views, use tokens; any new interactive control needs hover, focus-visible, disabled; visual spec at `frontend/e2e/dashboard-ui.spec.ts`; `tokens.md` in this change as the value record. Add the `npm run check:tokens` command to the Frontend commands list. Remove nothing else.

#### 3. Hard-coded-value check

**Files**: new `frontend/scripts/check-hardcoded-values.mjs`, `frontend/package.json`

**Intent**: Node script running the `/10x-ui` literal scan (hex, rgb/hsl/oklch, arbitrary px/rem, palette classes) over the cleaned files; exits non-zero on any hit. Wire as `npm run check:tokens`. Node script chosen over `grep` because the dev machine is Windows; no new dependency.

**Contract**: File list is explicit: `DashboardPage.tsx`, `ConsistencyCard.tsx`, `RecentRecords.tsx`, `WeeklyVolumeChart.tsx`, `chartTheme.ts`, `dashboard.css`, `page.css`; `index.css` (the token source) is never scanned.

### Success Criteria:

#### Automated Verification:

- New spec passes with baselines: `npm run test:e2e -- dashboard-ui.spec.ts`
- Full e2e suite passes: `npm run test:e2e`
- Guard passes on cleaned files: `npm run check:tokens`
- Guard fails when a literal is introduced (temporary `#123456` in `dashboard.css` makes it exit non-zero; reverted afterwards)
- Build, lint, unit tests pass: `npm run build && npm run lint && npm test`

#### Manual Verification:

- Eyeball the four baseline screenshots (desktop/mobile, light/dark) for overlap, clipping, readable axis labels
- Each of the 7 states is shown or marked N/A with a reason in the spec comments
- `CLAUDE.md` section reads correctly and sits outside any generated block

---

## Testing Strategy

### Unit Tests:

- None new. `chartTheme.ts` is plain data; covered by the build, the scan and the screenshot spec.

### Integration Tests:

- `dashboard-ui.spec.ts` (screenshots plus per-state assertions); existing specs (`log-set`, `progression-recommendation`, `muscle-group-stats`, `mobile-menu`) guard the CTA move and the moved CSS.

### Manual Testing Steps:

1. Open the dashboard in light and dark OS themes at desktop width and 375px.
2. Tab through all controls; check ring visibility and order.
3. Throttle the network and watch the loading to loaded transition.
4. Open History and Plans pages and confirm buttons look consistent.

## Performance Considerations

Skeleton animation is CSS-only and disabled for `prefers-reduced-motion`. No new runtime dependency.

## Migration Notes

None (no data or API change). Rollback is a revert of the CSS/TSX commits; the accent value change is the only visible change on other pages.

## References

- Related research: `context/changes/dashboard-ui-contract/research.md`
- Token source: `frontend/src/index.css:1-50`
- Shared primitives: `frontend/src/styles/page.css`
- Chart pattern: `frontend/src/components/WeeklyVolumeChart.tsx:20-31`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Token values

#### Automated

- [x] 1.1 Build and type check pass: `npm run build` (in `frontend/`) — 59cf0df
- [x] 1.2 Lint passes: `npm run lint` — 59cf0df
- [x] 1.3 No `#fff` left in `page.css` — 59cf0df
- [x] 1.4 Contrast of `--on-accent` on `--accent` is at least 4.5:1 in both themes (computed in `tokens.md`) — 59cf0df

#### Manual

- [x] 1.5 Login page and one other page look unchanged apart from the deeper purple in light mode — 59cf0df
- [x] 1.6 Dark mode shows dark text on the lighter purple button — 59cf0df

### Phase 2: Shared button and input states

#### Automated

- [x] 2.1 Build and lint pass: `npm run build && npm run lint` — 0dbb3fd
- [x] 2.2 Existing e2e specs still pass: `npm run test:e2e` — 0dbb3fd

#### Manual

- [x] 2.3 Tabbing through the dashboard shows the ring on the toggle, Save/Clear and both bottom links — 0dbb3fd
- [x] 2.4 Save and Clear look disabled while saving or with an empty/invalid goal — 0dbb3fd
- [x] 2.5 Spot-check History and Plans pages: buttons consistent, no regressions — 0dbb3fd

### Phase 3: Dashboard view

#### Automated

- [x] 3.1 Build, lint and unit tests pass: `npm run build && npm run lint && npm test` — 80e975d
- [x] 3.2 Hard-coded scan on the dashboard view files returns 0 hits — 80e975d
- [x] 3.3 Existing e2e specs pass, including `muscle-group-stats.spec.ts` — 80e975d

#### Manual

- [x] 3.4 Dark mode: chart axis labels and tooltip follow the theme — 80e975d
- [x] 3.5 Slow network: skeleton appears and the page does not jump when data arrives — 80e975d
- [x] 3.6 "Start workout" is visible without scrolling on a 375px-wide screen — 80e975d
- [x] 3.7 History progression chart looks right in both themes — 80e975d
- [x] 3.8 Muscle stats page still looks as before — 80e975d

### Phase 4: 7-state matrix, visual gate and guard

#### Automated

- [x] 4.1 New spec passes with baselines: `npm run test:e2e -- dashboard-ui.spec.ts` — 0752fab
- [x] 4.2 Full e2e suite passes: `npm run test:e2e` — 0752fab
- [x] 4.3 Guard passes on cleaned files: `npm run check:tokens` — 0752fab
- [x] 4.4 Guard fails when a literal is introduced (temporary `#123456` in `dashboard.css`, then reverted) — 0752fab
- [x] 4.5 Build, lint and unit tests pass: `npm run build && npm run lint && npm test` — 0752fab

#### Manual

- [x] 4.6 Four baseline screenshots reviewed (desktop/mobile, light/dark) for overlap, clipping, readable axis labels — 0752fab
- [x] 4.7 Each of the 7 states is shown or marked N/A with a reason in the spec comments — 0752fab
- [x] 4.8 `CLAUDE.md` UI section reads correctly and sits outside any generated block — 0752fab
