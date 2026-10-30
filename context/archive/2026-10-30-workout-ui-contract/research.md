---
date: 2026-10-30T11:28:52+01:00
researcher: Claude (Sonnet 5.5)
git_commit: 990ce08
branch: main
repository: 10xDevs
topic: "Workout UI audit: which charges feed the design-system contract change"
tags: [research, ui, workout, tokens, focus, dark-mode, shared-styles]
status: complete
last_updated: 2026-10-30
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Workout UI audit (`workout-ui-contract`)

**Date**: 2026-10-30T11:28:52+01:00
**Researcher**: Claude (Sonnet 5.5)
**Git Commit**: 990ce08 (working tree has an unrelated `.gitignore` change)
**Branch**: main
**Repository**: 10xDevs

## Research Question

Audit `WorkoutPage` (`/workout`) in both directions (source → views, view → source) against the 3 charge categories of `/10x-ui`, and give 3–5 charges with file, line and user impact. The token contract from `dashboard-ui-contract` (merged in PR #50) is the baseline.

## Summary

- **Variant:** existing design system made of plain CSS variables; tokens in `frontend/src/index.css` (extended by `dashboard-ui-contract`), shared classes in `frontend/src/styles/page.css`. No `components/ui`.
- **Hard-coded scan** (hex, `rgb()`, `hsl()`, `oklch()`, arbitrary `[Npx]`) on `WorkoutPage.tsx` and its 8 components: 0 hits. On `workout.css`: 1 hit, `#fff` at `workout.css:83`. The same file has 9 `border-radius` declarations with literals (`8px` ×7 at lines 19, 86, 116, 169, 200, 276, 321; `6px` ×1 at 187; `999px` ×1 at 306).
- **Biggest finding is architectural, not literal:** `workout.css` holds primitives that other views use (`.btn-danger`, `.workout-select`), and it styles the walkthrough rows without hover, focus or disabled states.
- 5 charges below, each mapped to a plan phase. Sibling views `/plans` and `/exercises` are out of scope (separate changes).

## Detailed Findings

### Source → views (token usage)

- Tokens available: `--on-accent`, `--radius`, `--radius-card`, `--ring`, `--chart-*` plus the original set (`index.css`, see `context/changes/dashboard-ui-contract/tokens.md`). There is **no `--on-danger`** token. Inspected set: `index.css`, `page.css`, `workout.css`.
- Shared classes available from the dashboard change: `.card`, `.stat-label`, `.stat-value`, `.skeleton*`, `.visually-hidden` (`page.css`, `dashboard.css`). In the 9 inspected workout files (`WorkoutPage.tsx` and its 8 components), none of `.card`, `.stat-*`, `.skeleton*` or `.visually-hidden` is used (a `card` grep matches only the unrelated `page-card workout-card` class on `WorkoutPage.tsx:219`, and `visually-hidden` has 0 matches in `RestTimer.tsx`); workout panels repeat their own border/radius/padding (see charge 3).
- `workout.css` has 1 `:focus-visible` rule (`workout.css:23`, `.workout-select`) and 0 `:disabled` and 0 `:hover` rules (inspected: the whole file, 339 lines).

### View → source (literals and gaps)

- `workout.css:83` `color: #fff` on `background: var(--danger)` (`.btn-danger`). Computed contrast of white on `--danger`: 5.73:1 in light (`#c0255d`), **2.65:1 in dark** (`#f472b6`, `index.css:58`). Dark text `#16171d` on the dark `--danger` would be 6.75:1.
- `.btn-danger` is used in 4 views outside the workout page: `SessionSetList.tsx:51` (workout), `HistoryDetailPage.tsx:140`, `MyExercisesPage.tsx:217`, `PlansPage.tsx:69`. `HistoryDetailPage.tsx:140` passes `disabled={deleting}`, but `.btn-danger` has no `:disabled` rule, so the button looks enabled while the request runs. `HistoryDetailPage.tsx` does not import `workout.css` (it imports `page.css`, `history.css`); it gets the style only because the SPA bundles all pages.
- `.workout-select` (`workout.css:9-27`) duplicates `.field input` (`page.css:36-60`) for `<select>`. It is used by `WorkoutPage.tsx:227`, `ExercisePicker.tsx:18`, `RestTimer.tsx:72` and `MyExercisesPage.tsx:144`. Its focus ring is `border-color` + `box-shadow` with `outline: none`, not the `--ring` outline used for buttons since Phase 2 of the dashboard change.
- `.walkthrough-entry` (`workout.css:261-279`) is a full-width `<button>` (`PlanWalkthrough.tsx:38-40`) with no `:hover`, no `:focus-visible` and no `:disabled` rule. Selected state is a border plus a 2px `box-shadow` (`workout.css:281-284`); `aria-current="step"` is set for the current step only (`PlanWalkthrough.tsx:41`).
- `.rest-timer-live` (`workout.css:219-229`) re-implements `.visually-hidden` (`page.css:44`).
- `.walkthrough-skipped-badge` (`workout.css:299-307`) is a second pill badge next to `.pr-badge` (`page.css:159`).
- Panels `.substitute-panel` (`:113`), `.progression-recommendation` / `.previous-workout-hint` (`:165`), `.rest-timer` (`:196`) each repeat `border: 1px solid var(--border); border-radius: 8px; padding`. That is the `.card` surface defined in `page.css:27`.

### States (7-state matrix, current state for this view)

- **loading:** `WorkoutPage.tsx:213-215` returns `null` while `loading` is true, so `/workout` renders an empty page until `getExercises`, `getCurrentSession` and `listPlans` all resolve. Inner panels use text-only loading: `SubstituteSuggestions.tsx:56`, `ProgressionChart.tsx:62`; `PlansPage.tsx:52` is a sibling view (out of scope).
- **error:** `WorkoutPage.tsx:221` renders `<p className="error-text">` without `role="alert"`; `ProgressionChart.tsx:64` same. `SubstituteSuggestions.tsx:59` does use `role="alert"`.
- **empty:** `SessionSetList.tsx:23` shows `workout.noSets` text; the no-session state shows start buttons (`WorkoutPage.tsx:222-252`). Both are real states, not blank frames.
- **disabled:** primary buttons are covered by `.btn-primary:disabled` and `.btn-secondary:disabled` from the dashboard change. `.btn-danger` has none (above). The delete and confirm buttons in `SessionSetList.tsx:51-59` receive no disabled state while `busy` is true (the `busy` flag is not a prop of `SessionSetList`).
- **hover / focus-visible:** `.btn-primary`, `.btn-secondary` covered by `page.css`; `.btn-danger`, `.walkthrough-entry` and `.workout-select` hover are not (only `.workout-select` has its own focus rule).

### Auth / entry point (charge category 3)

- `/workout` is wrapped in `RequireAuth` (`App.tsx:39-45`), so no unauthenticated gap. A deleted plan falls back silently to the free-form view (`WorkoutPage.tsx:67`), an intentional design noted in code.

## Charges

| # | Category | Charge | Evidence | User impact | Plan phase |
|---|---|---|---|---|---|
| 1 | Missing tokens | White text on `--danger` and radius literals: no `--on-danger`; 9 `border-radius` literals | `workout.css:83`; `workout.css:19,86,116,169,187,200,276,306,321`; contrast 2.65:1 in dark | Delete buttons are hard to read in dark mode; radii drift from the rest of the app | 1 (tokens) |
| 2 | Missing shared component | `.btn-danger` and `.workout-select` are shared primitives living in `workout.css`; `.btn-danger` has no hover/focus/disabled; `.workout-select` has its own focus style | `workout.css:9-27,77-88`; users: `HistoryDetailPage.tsx:140`, `MyExercisesPage.tsx:144,217`, `PlansPage.tsx:69` | Deleting a workout shows no disabled look while pending; keyboard focus on delete and select differs from other buttons | 2 (shared states) |
| 3 | Missing shared component | Walkthrough rows are buttons with no hover/focus-visible; panels repeat the card surface; `.rest-timer-live` duplicates `.visually-hidden`; second badge pill | `workout.css:261-279,113-117,165-170,196-201,219-229,299-307`; `PlanWalkthrough.tsx:38` | Keyboard users cannot see which walkthrough row has focus; maintenance drift | 3 (view) |
| 4 | Accidental architecture | `if (loading) return null` leaves a blank page; inner panels use text-only loading; page-level error has no `role="alert"` | `WorkoutPage.tsx:213-215,221`; `ProgressionChart.tsx:62,64`; `SubstituteSuggestions.tsx:56` | Blank screen on slow network; load errors not announced to screen readers | 3 (view) |
| 5 | Guard | `check:tokens` does not scan the workout files; `CLAUDE.md` UI section names only the dashboard spec | `frontend/scripts/check-hardcoded-values.mjs:11-19`; `CLAUDE.md` UI conventions | Literals can come back without any check failing | 4 (guard) |

**Deferred (not in this change):** the `8px` literals in `plans.css` (1) and the other views' own CSS, `topbar.css` overlay, `/plans` and `/exercises` views (separate `plans-ui-contract`, `exercises-ui-contract`), loading text in `PlansPage.tsx:52`.

## Code References

- `frontend/src/styles/workout.css:83` - `#fff` on `--danger`
- `frontend/src/styles/workout.css:9-27` - `.workout-select` (shared by 4 files)
- `frontend/src/styles/workout.css:77-88` - `.btn-danger` (shared by 4 views)
- `frontend/src/styles/workout.css:261-307` - walkthrough rows and skipped badge
- `frontend/src/pages/WorkoutPage.tsx:213-221` - blank loading, error text
- `frontend/src/components/SessionSetList.tsx:51-59` - delete and confirm buttons
- `frontend/src/components/PlanWalkthrough.tsx:38-60` - row and skip buttons
- `frontend/src/pages/HistoryDetailPage.tsx:140` - `btn-danger` with `disabled={deleting}`
- `frontend/src/index.css:21,58` - `--danger` values
- `frontend/scripts/check-hardcoded-values.mjs:11-19` - guard file list

## Architecture Insights

- Plain CSS, one stylesheet per page, with a shared `page.css`. Primitives drifted into page stylesheets (`workout.css`) and other pages import them, so a view-specific file doubles as a shared one. Dashboard change fixed this for `.muscle-*` by moving them; the same pattern applies to `.btn-danger` and `.workout-select`.
- Moving `.btn-danger` and `.workout-select` to `page.css` changes `/plans`, `/exercises` and `/history/:id` visuals (their appearance is shared today); the plan must keep them visually equal apart from the contrast and state fixes.

## Historical Context (from prior changes)

- `context/changes/dashboard-ui-contract/plan.md` - contract, 7-state matrix and guard pattern to repeat; it deferred the `workout.css` `8px` radii ("What We're NOT Doing").
- `context/changes/dashboard-ui-contract/tokens.md` - values and contrast record; dark `--danger` was not computed there.
- `context/changes/dashboard-ui-contract/reviews/impl-review.md` - guard regex lesson: build patterns with `String.raw`.

## Related Research

- `context/changes/dashboard-ui-contract/research.md` - same audit method on the dashboard.

## Open Questions

- Dark `--danger` text colour: reuse `--on-accent` (`#16171d`) or add `--on-danger`? Recommendation: add `--on-danger` (white in light, `#16171d` in dark) so the role stays explicit.
- Should `.btn-danger` and `.workout-select` move to `page.css` in this change (touches 3 sibling views visually) or only get their states fixed in place? Recommendation: move, with a quick look at `/plans`, `/exercises`, `/history/:id`.
- Skeleton for the page-level load: `WorkoutPage` knows nothing about its final shape before the session loads (start buttons vs active session); a neutral skeleton card is the simplest option.
