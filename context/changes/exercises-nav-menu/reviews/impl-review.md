<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Unified exercises list with filters

- **Plan**: context/changes/exercises-nav-menu/plan.md
- **Scope**: Full plan (3 of 3 phases, plus the top-bar menu follow-up recorded in the plan header)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Exercise form keeps the edited exercise's values when opened as "New exercise"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/ExerciseFormPage.tsx:16-56, frontend/src/App.tsx:95-110
- **Detail**: `/exercises/:id/edit` and `/exercises/new` render the same component at the same tree position, so React reuses the instance and its state (name, primary, secondary, notFound, loading). Verified with a throwaway Playwright test: edit an exercise, open Exercises ▾ → New exercise, and the Name field still contains the edited exercise's name (Expected "", Received the old name). Saving would create a duplicate-looking exercise.
- **Fix**: Give the form a key from the route, e.g. a small wrapper `<ExerciseFormPage key={id ?? 'new'} />`, and add an e2e case "edit then New exercise starts empty".
- **Decision**: FIXED (2026-11-03): the form is keyed by the route (`ExerciseFormPage` wrapper), so edit then New starts empty; e2e regression test added.

### F2 — Concurrent delete closes another row's confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/ExercisesPage.tsx:53-65, :154-169
- **Detail**: `busy` only disables the confirming row's buttons. Clicking Delete on row B while A's request is in flight sets `confirmingId` to B, and A's `finally` then runs `setConfirmingId(null)`, silently closing B's confirmation.
- **Fix**: Disable the other rows' Delete (and Edit) while `busy`, and clear `confirmingId` only if it still equals the deleted id.
- **Decision**: FIXED (2026-11-03): other rows' Delete is disabled while a delete is in flight and only the deleted row's confirmation is closed; e2e test added.

### F3 — Focus is lost in several interactions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/ExercisesMenu.tsx:33-37, :69-72; frontend/src/pages/ExercisesPage.tsx:57-64; frontend/src/pages/ExerciseFormPage.tsx:78-88
- **Detail**: Focus falls to the page body after (a) choosing a menu item (the list unmounts under the focused link), (b) pressing Escape in the mobile drawer (the drawer becomes visibility:hidden, so `buttonRef.focus()` does nothing and Topbar does not return focus to its hamburger), (c) confirming or cancelling a delete, (d) Cancel on the form page. The menu's Escape listener also stays attached while the drawer is closed.
- **Fix**: Focus the menu button before closing it; only move focus when the button is visible and have Topbar focus its toggle on Escape; after delete/cancel focus the list heading or the triggering row's Delete button.
  - Strength: Keyboard and screen-reader users keep their place; same pattern as applied to SaveAsPlan.
  - Tradeoff: Touches four components and needs a few refs.
  - Confidence: MED — behaviour inferred from code, not tested with a screen reader.
  - Blind spot: Router-level focus handling on navigation was not checked.
- **Decision**: FIXED (2026-11-03): focus now returns to the menu button after choosing an item, to the hamburger toggle after Escape on a phone (the menu no longer handles Escape there), to the row's Delete button after Cancel or a failed delete, and to the heading after a successful delete. NOT changed: Cancel on the form page just navigates (focus after route changes is left to the router).

### F4 — Missing e2e coverage for important cases

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/e2e/exercises-list.spec.ts, frontend/e2e/mobile-menu.spec.ts
- **Detail**: Not covered: deleting a custom exercise that is used in a plan or workout (backend returns 409 EXERCISE_IN_USE; the UI should show an alert and keep the row); 409 EXERCISE_NAME_TAKEN on create/update; the edit-then-New carry-over (F1); concurrent delete (F2). The mobile menu test only toggles visibility: no aria-expanded, no check that the group starts expanded on an exercises page, that an outside tap keeps it open, that choosing an item closes the drawer, or Escape while open.
- **Fix**: Add e2e cases for the 409 in-use delete, name-taken, edit→New empty form, and extend the mobile-menu spec with the missing behaviours.
  - Strength: Protects the paths most likely to regress and the new menu's mobile behaviour.
  - Tradeoff: More e2e time; the in-use case needs a plan seeded with a custom exercise.
  - Confidence: HIGH — backend codes verified at ExerciseService.java:90 and :99.
  - Blind spot: None significant.
- **Decision**: FIXED (2026-11-03): added e2e for edit-then-New, 409 in-use delete, name taken, focus after cancel/delete, concurrent delete, and a mobile-menu test (aria-expanded, expanded on an exercises page, outside tap, drawer closes, Escape returns focus). The mobile test also found that choosing an item collapsed the group on a phone; it now stays expanded.

### F5 — Small menu behaviours

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/ExercisesMenu.tsx:23, :29-31, :62, :86
- **Detail**: `open` is initialised from matchMedia once (resizing to a phone width leaves the group collapsed); the desktop popover does not close when focus tabs out; the `setTimeout` used to focus after opening is never cleared; `aria-controls` points to an id that does not exist while closed.
- **Fix**: Optional tidy-ups: close on focusout, clear the timer in an effect cleanup, set `aria-controls` only when open.
- **Decision**: FIXED (2026-11-03): resize listener expands/collapses the group at the phone breakpoint, the popover closes when focus tabs out, the focus timer is cleaned up, `aria-controls` is only set while open.

### F6 — Page-level observations

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/ExercisesPage.tsx:34-51, :113-118; frontend/src/pages/ExerciseFormPage.tsx:33
- **Detail**: `aria-live="polite"` wraps the whole list so every filter change may announce it all; a failed delete shows its error at the top of the card, away from the row; a load failure has no retry; the form's load failure shows no back link; edit mode downloads the whole exercise list to find one record (no single-exercise endpoint).
- **Fix**: Move the live region to a small result-count element; optionally show the error near the row and add a back link.
- **Decision**: PARTLY FIXED (2026-11-03): the live region is now a small result-count element (new `exercises.resultCount` strings, with Polish plurals) and the form shows a back link when loading fails. ACCEPTED, not changed: error shown at the top of the card for a failed delete, no retry button on load failure, and edit mode still downloads the full exercise list (no single-exercise endpoint).

### F7 — Small unplanned extras and style placement

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/styles/exercises.css:35-38; frontend/src/pages/ExercisesPage.tsx:10
- **Detail**: `.plans-link-button:focus-visible` was added to exercises.css although the class is only used by PlansPage (it belongs in plans.css). ExercisesPage imports dashboard.css just to reuse `.dashboard-toggle`, a cross-page style dependency.
- **Fix**: Move the focus rule to plans.css; consider moving the segmented-toggle styles to page.css.
- **Decision**: FIXED (2026-11-03): the `.plans-link-button:focus-visible` rule moved to plans.css; the segmented toggle styles moved to page.css and the dashboard.css import was dropped from ExercisesPage.

### F8 — Plan note wording

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/exercises-nav-menu/plan.md:5
- **Detail**: The follow-up note says "four desktop screenshot baselines" were refreshed; in fact eight PNGs changed (the Windows and Linux file for each of four images).
- **Fix**: Reword to "four desktop screenshots (Windows and Linux baselines)".
- **Decision**: FIXED (2026-11-03): plan note reworded.
