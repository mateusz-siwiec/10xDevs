<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Workout Dashboard

- **Plan**: context/changes/workout-dashboard/plan.md
- **Scope**: Full plan (Phases 1–2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria evidence (re-run during this review): `./mvnw test` → 106 tests, 0 failures (new class: 7 tests); `npm run build` exit 0; `npm run lint` exit 0 (2 pre-existing warnings in `AuthContext.tsx`). Break-check during implementation: removing the window/active-session condition turned 2 tests red. Manual items 1.3–1.4 and 2.3–2.7 were confirmed by the user.

## Findings

### F1 — Pressed toggle has low contrast and is distinguished mostly by colour

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/styles/dashboard.css:17-19
- **Detail**: The pressed 7/30 button uses `--accent` (#aa3bff) text on a 10% accent tint, roughly 4:1 contrast (below AA 4.5:1 for body-size text); the selected state differs from the unselected one mainly by colour.
- **Fix**: Use `var(--text-h)` for the pressed text and add a stronger signal (bolder weight or a solid border).
- **Decision**: FIXED — pressed toggle now uses var(--text-h), solid accent border and bolder weight (dashboard.css)

### F2 — Loading/error content swaps silently for screen-reader users

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/DashboardPage.tsx:56-58
- **Detail**: Toggling 7/30 swaps the tiles for "Loading stats…" or an error with no live region, so the change is not announced.
- **Fix**: Wrap `body` in a persistent `<div aria-live="polite">` and give the error paragraph `role="alert"`.
- **Decision**: FIXED — body wrapped in aria-live="polite" and error given role="alert" (DashboardPage.tsx)

### F3 — Copy edge cases: empty state wording and sub-minute durations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/DashboardPage.tsx:17, 62
- **Detail**: "No completed workouts yet in the last 7 days. Start your first workout…" is misleading for a user whose last workout was 10 days ago; and `formatDuration` shows `0m` for totals under a minute.
- **Fix**: Reword to "No completed workouts in the last N days." and show `<1m` when the total is above 0 but under 60 seconds.
- **Decision**: FIXED — empty-state wording made neutral and formatDuration returns <1m for totals under a minute (DashboardPage.tsx)

### F4 — Redundant hover rule duplicates `.btn-primary`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/dashboard.css:57-59
- **Detail**: `.dashboard-card .dashboard-start:hover { opacity: 0.9 }` duplicates `.btn-primary:hover:not(:disabled)` from `page.css`.
- **Fix**: Remove the rule.
- **Decision**: FIXED — redundant .dashboard-start:hover rule removed (dashboard.css)

### F5 — Untested `days` edge cases

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/test/java/com/example/gymtrack/workout/DashboardControllerTest.java
- **Detail**: `days=abc` (handled by the existing type-mismatch handler) and `days=0` / negative values are not pinned; only `days=14` is.
- **Fix**: Add tests that `days=abc` and `days=0` return 400.
- **Decision**: FIXED — added zeroDaysReturnsBadRequest and nonNumericDaysReturnsBadRequest (DashboardControllerTest.java)
