# Workout UI design-system contract Implementation Plan

## Overview

Bring the workout page (`WorkoutPage` and its 8 components) onto the repo's CSS-variable design system set up by `dashboard-ui-contract`, and close the gaps the audit found: white text on `--danger` with no token, radius literals, shared primitives (`.btn-danger`, `.workout-select`) living in a page stylesheet without hover/focus/disabled states, a blank page while loading, unannounced load errors, and walkthrough rows without hover or focus styles. The change ends with a screenshot gate for `/workout` and an extended `check:tokens` guard.

## Current State Analysis

- Variant: **existing design system, plain CSS variables**. Tokens in `frontend/src/index.css` (`--on-accent`, `--radius`, `--radius-card`, `--ring`, `--chart-*` added by the dashboard change); shared classes in `frontend/src/styles/page.css` (`.btn-primary`, `.btn-secondary`, `.card`, `.stat-*`, `.visually-hidden`, `.pr-badge`, `.field`). Values recorded in `context/changes/dashboard-ui-contract/tokens.md`.
- `workout.css` (339 lines): one literal colour, `#fff` at `:83` on `var(--danger)`; 9 radius literals (`8px` at 19, 86, 116, 169, 200, 276, 321; `6px` at 187; `999px` at 306); 1 `:focus-visible` rule (`:23`), 0 `:hover`, 0 `:disabled`.
- Contrast (computed in research): white on `--danger` is 5.73:1 light (`#c0255d`), 2.65:1 dark (`#f472b6`); `#16171d` on dark `--danger` is 6.75:1.
- `.btn-danger` (`workout.css:77-88`) is used by `SessionSetList.tsx:51`, `HistoryDetailPage.tsx:140` (with `disabled={deleting}`), `MyExercisesPage.tsx:217`, `PlansPage.tsx:69`; `plans.css:71` overrides it inside `.plans-card`. `.workout-select` (`workout.css:9-27`) is used by `WorkoutPage.tsx:227`, `ExercisePicker.tsx:18`, `RestTimer.tsx:72`, `MyExercisesPage.tsx:144`.
- `WorkoutPage.tsx:213-215` returns `null` while loading; the page-level error (`:221`) and `ProgressionChart.tsx:64` have no `role="alert"`. There is no `workout.loading` i18n key (only `history.detail.loading`, `workout.substitutes.loading`, ...).
- `/workout` is behind `RequireAuth` (`App.tsx:39-45`); no auth gap.
- Tooling: Playwright (`frontend/e2e/`, Chromium; `dashboard-ui.spec.ts` with `-win32` and `-linux` baselines), `oxlint`, `vitest`, `npm run check:tokens` (`frontend/scripts/check-hardcoded-values.mjs`, explicit file list).

Full evidence: `context/changes/workout-ui-contract/research.md` (`## Charges`).

## Desired End State

On `/workout` every colour and radius comes from tokens in both themes; text on danger buttons is at least 4.5:1 in both themes; `.btn-danger` and `.workout-select` live in `page.css` with hover, `--ring` focus-visible and disabled states and look the same on `/plans`, `/exercises` and `/history/:id` apart from those fixes; loading shows a skeleton card (never a blank page); load errors are announced; walkthrough rows show hover and a visible focus ring. A Playwright spec captures `/workout` (desktop and 375px, light and dark) plus assertions for the 7 states, `check:tokens` covers the workout files, and `CLAUDE.md` lists the workout spec.

### Key Discoveries:

- `.btn-danger` / `.workout-select` are shared by 3 sibling views, so Phase 2 changes their look slightly (intended; needs a quick look, see Manual Verification).
- `plans.css:71` styles `.btn-danger` with an override; moving the base rule must keep that override winning (same specificity order: `page.css` must load before `plans.css`; both are imported by the pages, `page.css` first).
- `HistoryDetailPage.tsx` does not import `workout.css` today and gets `.btn-danger` only because the SPA bundles all pages; after the move it gets it from `page.css`, which it imports.
- `rest-timer-live` (`workout.css:219-229`) duplicates `.visually-hidden` (`page.css:44`); the skipped badge (`workout.css:299-307`) duplicates `.pr-badge`'s pill pattern.
- Existing e2e specs (`log-set`, `progression-recommendation`, `delete-workout`, `data-isolation`, `muscle-group-stats`) use the workout page by role/label; they must stay green.

## What We're NOT Doing

- No rebrand, no layout redesign of the walkthrough, no change to `/plans` or `/exercises` beyond the visual effect of the shared-class move. Their own changes (`plans-ui-contract`, `exercises-ui-contract`) come later.
- No change to `plans.css`, `exercises.css`, `history.css` radius literals, or `topbar.css` (deferred).
- No new dependency, no `shadcn init`, no dark-mode toggle (the app follows `prefers-color-scheme`).
- No API or business-logic change; the only i18n change is one new key `workout.loading` (en + pl).
- Not a WCAG audit: contrast is checked for the changed tokens only.

## Implementation Approach

Order is fixed by the `/10x-ui` contract: token values, shared states, the one view, then the 7-state matrix, gate and guard. Everything is a CSS variable on `:root` so the dark override keeps working. Raw values go to `context/changes/workout-ui-contract/tokens.md` so the next session does not re-invent them.

Decided in planning:

- **Danger text:** new `--on-danger`: `#fff` in light (5.73:1), `#16171d` in dark (6.75:1).
- **Shared styles:** move `.btn-danger` and `.workout-select` to `page.css`, tokenised, with hover / `--ring` focus-visible / disabled. Remove them from `workout.css`.
- **Loading:** neutral skeleton card (title, one button-sized block, one larger block) plus visually hidden status text, reusing `.skeleton` / `.visually-hidden` from the dashboard change; new i18n key `workout.loading`.
- **Walkthrough:** hover (border colour), `--ring` focus-visible, token-driven; no layout change.
- **Gate:** Playwright `toHaveScreenshot` plus state assertions in `e2e/workout-ui.spec.ts`; Linux baselines are taken from the CI runner (same as the dashboard change), Windows baselines locally.

## Phase 1: Token values

### Overview

Add the missing danger-text token and replace the literals in `workout.css`. Covers charge 1.

### Changes Required:

#### 1. Token source

**File**: `frontend/src/index.css`

**Intent**: Add `--on-danger` to `:root` and override it in the dark block, so text on filled danger surfaces has 4.5:1 or more in both themes.

**Contract**: `--on-danger: #fff` (light), `--on-danger: #16171d` (dark). Add it next to `--on-accent`.

#### 2. Literals in the workout stylesheet

**File**: `frontend/src/styles/workout.css`

**Intent**: Replace `#fff` (`:83`) with `var(--on-danger)` and every `border-radius` literal (`8px`, `6px`, `999px`) with the matching token (`var(--radius)` for 8px and 6px, `var(--radius-card)` for the pill at `:306`, as done for `.muscle-bar` on the dashboard change).

**Contract**: No class renames; no visual change except the dark danger text colour and a 2px radius change on the previous-workout list items (6px to 8px).

#### 3. Value record

**File**: `context/changes/workout-ui-contract/tokens.md`

**Intent**: Raw values per theme for `--on-danger`, computed contrast ratios (both themes), and the line "values live in `frontend/src/index.css`".

### Success Criteria:

#### Automated Verification:

- Build and type check pass: `npm run build` (in `frontend/`)
- Lint passes: `npm run lint`
- No `#fff` and no radius `px` literal left in `workout.css`: `grep -nE "#fff|border-radius: *[0-9]+px" frontend/src/styles/workout.css` returns nothing
- Contrast of `--on-danger` on `--danger` is at least 4.5:1 in both themes (computed in `tokens.md`)

#### Manual Verification:

- Delete button on a logged set shows dark text on the pink in dark mode and white text in light mode
- Workout page looks otherwise unchanged

---

## Phase 2: Shared button and select states

### Overview

Move the shared primitives out of the page stylesheet and give them the same state contract as the other buttons. Covers charge 2.

### Changes Required:

#### 1. Shared danger button

**Files**: `frontend/src/styles/page.css`, `frontend/src/styles/workout.css`

**Intent**: Move `.btn-danger` from `workout.css` to `page.css`, next to `.btn-secondary`, using tokens; add `:hover:not(:disabled)` (opacity as `.btn-primary`), `:focus-visible` (the same `--ring` outline), and `:disabled` (opacity 0.6, default cursor). Delete it from `workout.css`.

**Contract**: Selectors `.btn-danger`, `.btn-danger:hover:not(:disabled)`, `.btn-danger:disabled`, and add `.btn-danger` to the existing `:focus-visible` selector list. The `.plans-card .btn-danger` override in `plans.css:71` stays untouched and keeps working because `page.css` loads first.

#### 2. Shared select

**Files**: `frontend/src/styles/page.css`, `frontend/src/styles/workout.css`

**Intent**: Move `.workout-select` to `page.css` (name unchanged, 4 users), tokenised, with the same border, focus and disabled treatment as `.field input` (including the `--accent` border + `--accent-bg` ring on focus-visible, which matches the existing select focus) and a `:disabled` look. Delete it from `workout.css`.

**Contract**: Class name unchanged; `workout.css` keeps only workout-specific layout rules (`.workout-card .btn-*` min-height stays).

### Success Criteria:

#### Automated Verification:

- Build and lint pass: `npm run build && npm run lint`
- `.btn-danger` and `.workout-select` no longer defined in `workout.css`: `grep -nE "^\.btn-danger|^\.workout-select" frontend/src/styles/workout.css` returns nothing
- Existing e2e specs still pass: `npm run test:e2e`

#### Manual Verification:

- Tab to a delete button: the ring shows; the history detail delete button looks disabled while the request runs (slow network)
- Spot-check `/plans`, `/exercises`, `/history/:id`: delete buttons and selects look consistent, no regressions

---

## Phase 3: Workout view

### Overview

Make the view consume the contract. Covers charges 3 and 4.

### Changes Required:

#### 1. Page-level loading and error

**Files**: `frontend/src/pages/WorkoutPage.tsx`, `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`, `frontend/src/styles/workout.css`

**Intent**: Replace `if (loading) return null` with the page shell, the title and a skeleton card (one button-sized block and one larger block), in a `role="status"` region with `<span className="visually-hidden">` text from the new key `workout.loading` (en: "Loading workout…", pl: "Wczytywanie treningu…"); skeleton blocks `aria-hidden`. Add `role="alert"` to the page-level error `<p>` (`:221`).

**Contract**: New i18n key `workout.loading` in both locales; new classes `.skeleton-button` and `.skeleton-block` in `workout.css` (or reuse `.skeleton` plus a modifier) with `min-height` values close to the start-screen button (48px) and a card; coloured by `.skeleton` from the dashboard change.

#### 2. Panels, hidden text and badge reuse

**Files**: `frontend/src/styles/workout.css`, `frontend/src/components/RestTimer.tsx`, `SubstituteSuggestions.tsx`, `PreviousWorkoutHint.tsx`, `ProgressionRecommendation.tsx`, `PlanWalkthrough.tsx`

**Intent**: Use `.card` (plus padding) for `.substitute-panel`, `.progression-recommendation`, `.previous-workout-hint`, `.rest-timer` and drop their own border/radius; replace `.rest-timer-live` with `.visually-hidden`; render the skipped badge with `.pr-badge` and delete `.walkthrough-skipped-badge`.

**Contract**: Class additions in the TSX files named above; the removed rules disappear from `workout.css`; e2e selectors checked (`grep` in `frontend/e2e/` for the removed class names before deleting).

#### 3. Walkthrough row states

**File**: `frontend/src/styles/workout.css`

**Intent**: Add `:hover:not(:disabled)` (border-colour change to `--accent-border`) and a `--ring` `:focus-visible` outline to `.walkthrough-entry`; keep selected and current styles as they are.

**Contract**: Selectors `.walkthrough-entry:hover`, `.walkthrough-entry:focus-visible`; the selected-state `box-shadow` stays.

#### 4. Progression chart error

**File**: `frontend/src/components/ProgressionChart.tsx`

**Intent**: Add `role="alert"` to the load-error `<p>` (`:64`).

**Contract**: One attribute.

### Success Criteria:

#### Automated Verification:

- Build, lint and unit tests pass: `npm run build && npm run lint && npm test`
- Hard-coded scan on the workout files returns 0 hits: `/10x-ui` scan on `WorkoutPage.tsx`, `workout.css` and the 8 components
- Existing e2e specs pass: `npm run test:e2e`

#### Manual Verification:

- Slow network: skeleton card appears instead of a blank page; no big jump when the start screen or session renders
- Dark mode: panels, walkthrough rows, delete buttons look correct
- Tab through the walkthrough rows and bottom buttons: the ring is visible on each
- `/plans` and `/exercises` still look as before

---

## Phase 4: 7-state matrix, visual gate and guard

### Overview

Prove the states, gate the view with screenshots, and leave the guard and rule. Covers charge 5 and the Definition of Done.

### Changes Required:

#### 1. Workout visual and state spec

**File**: new `frontend/e2e/workout-ui.spec.ts`

**Intent**: Register a user via API (`e2e/helpers.ts`), create a plan with 2-3 exercises, start a session from it and log one set via the API so the full page renders (walkthrough, picker, logger, rest timer, chart, logged sets), then cover the 7 states:

- default: `toHaveScreenshot` for desktop and 375px, each in light and dark (`page.emulateMedia`), masking the chart, dates and the user e-mail (same pinning as the dashboard spec); small `maxDiffPixels`
- hover: the hovered walkthrough row's border colour differs from rest
- focus-visible: tab to a walkthrough row and assert an outline colour equal to `--ring`
- disabled: with no selected exercise (free-form session) the Log set button is disabled with computed opacity below 1
- error: route-fail the current-session request; assert the alert is visible with the `--danger` colour and `role="alert"`
- empty: free-form session with no sets shows the `noSets` text, not a blank frame
- loading: delay the exercises request; assert the skeleton card is visible, then compare the card height before and after load within a small tolerance

**Contract**: Header comment documents the 7 states and that baselines are platform-specific (Windows locally, Linux from the CI run's own images, reviewed by eye). First baselines are created deliberately with `--update-snapshots` and reviewed by eye; never refreshed without an explained visual delta.

#### 2. Guard coverage

**File**: `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Add the workout files to the explicit list: `WorkoutPage.tsx`, `SetLogger.tsx`, `SessionSetList.tsx`, `RestTimer.tsx`, `PlanWalkthrough.tsx`, `PreviousWorkoutHint.tsx`, `ProgressionRecommendation.tsx`, `SubstituteSuggestions.tsx`, `ExercisePicker.tsx`, `workout.css`.

**Contract**: Same patterns; `index.css` still never scanned; guard must pass on the cleaned files and fail when a literal is introduced.

#### 3. Agent rule

**File**: `CLAUDE.md`

**Intent**: In the existing `## UI conventions` section (outside the generated CLI block): mention `frontend/e2e/workout-ui.spec.ts` next to the dashboard spec, update the `check:tokens` line to say it scans the dashboard and workout files, and note that shared primitives (`.btn-danger`, `.workout-select`) live in `page.css`. Remove nothing else.

**Contract**: Edits limited to that section and the Frontend commands line for `check:tokens`.

### Success Criteria:

#### Automated Verification:

- New spec passes with baselines: `npm run test:e2e -- workout-ui.spec.ts`
- Full e2e suite passes: `npm run test:e2e`
- Guard passes on cleaned files: `npm run check:tokens`
- Guard fails when a literal is introduced (temporary `#123456` in `workout.css` makes it exit non-zero; reverted afterwards)
- Build, lint, unit tests pass: `npm run build && npm run lint && npm test`

#### Manual Verification:

- Eyeball the four baseline screenshots (desktop/mobile, light/dark) for overlap, clipping, readable text
- Each of the 7 states is shown or marked N/A with a reason in the spec comments
- `CLAUDE.md` UI section reads correctly and sits outside any generated block

---

## Testing Strategy

### Unit Tests:

- None new. The change is CSS plus small JSX attributes; covered by build, lint, the scan and the screenshot spec.

### Integration Tests:

- `workout-ui.spec.ts` (screenshots plus per-state assertions); existing specs (`log-set`, `progression-recommendation`, `delete-workout`, `data-isolation`) guard the workout flow and the moved styles.

### Manual Testing Steps:

1. Open `/workout` (start screen and an active plan session) in light and dark OS themes at desktop width and 375px.
2. Tab through all controls; check ring visibility and order.
3. Throttle the network and watch the loading to loaded transition.
4. Open `/plans`, `/exercises`, `/history/:id` and confirm delete buttons and selects look consistent.

## Performance Considerations

Skeleton animation is CSS-only (reuses the dashboard `.skeleton` rules, disabled for `prefers-reduced-motion`). No new runtime dependency.

## Migration Notes

None (no data or API change). Rollback is a revert of the CSS/TSX commits; the only visible changes on other pages are the danger text colour in dark mode and the new states on `.btn-danger` / `.workout-select`.

## References

- Related research: `context/changes/workout-ui-contract/research.md`
- Previous change (pattern to repeat): `context/changes/dashboard-ui-contract/plan.md`
- Token source: `frontend/src/index.css`
- Shared primitives: `frontend/src/styles/page.css`
- Guard: `frontend/scripts/check-hardcoded-values.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Token values

#### Automated

- [x] 1.1 Build and type check pass: `npm run build` (in `frontend/`)
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 No `#fff` and no radius `px` literal left in `workout.css`
- [x] 1.4 Contrast of `--on-danger` on `--danger` is at least 4.5:1 in both themes (computed in `tokens.md`)

#### Manual

- [x] 1.5 Delete button on a logged set shows dark text in dark mode and white text in light mode
- [x] 1.6 Workout page looks otherwise unchanged

### Phase 2: Shared button and select states

#### Automated

- [ ] 2.1 Build and lint pass: `npm run build && npm run lint`
- [ ] 2.2 `.btn-danger` and `.workout-select` no longer defined in `workout.css`
- [ ] 2.3 Existing e2e specs still pass: `npm run test:e2e`

#### Manual

- [ ] 2.4 Tab to a delete button shows the ring; history detail delete looks disabled while the request runs
- [ ] 2.5 Spot-check `/plans`, `/exercises`, `/history/:id`: delete buttons and selects consistent, no regressions

### Phase 3: Workout view

#### Automated

- [ ] 3.1 Build, lint and unit tests pass: `npm run build && npm run lint && npm test`
- [ ] 3.2 Hard-coded scan on the workout files returns 0 hits
- [ ] 3.3 Existing e2e specs pass: `npm run test:e2e`

#### Manual

- [ ] 3.4 Slow network: skeleton card appears instead of a blank page, no big jump when content renders
- [ ] 3.5 Dark mode: panels, walkthrough rows and delete buttons look correct
- [ ] 3.6 Tabbing through the walkthrough rows and bottom buttons shows the ring on each
- [ ] 3.7 `/plans` and `/exercises` still look as before

### Phase 4: 7-state matrix, visual gate and guard

#### Automated

- [ ] 4.1 New spec passes with baselines: `npm run test:e2e -- workout-ui.spec.ts`
- [ ] 4.2 Full e2e suite passes: `npm run test:e2e`
- [ ] 4.3 Guard passes on cleaned files: `npm run check:tokens`
- [ ] 4.4 Guard fails when a literal is introduced (temporary `#123456` in `workout.css`, then reverted)
- [ ] 4.5 Build, lint and unit tests pass: `npm run build && npm run lint && npm test`

#### Manual

- [ ] 4.6 Four baseline screenshots reviewed (desktop/mobile, light/dark) for overlap, clipping, readable text
- [ ] 4.7 Each of the 7 states is shown or marked N/A with a reason in the spec comments
- [ ] 4.8 `CLAUDE.md` UI section reads correctly and sits outside any generated block
