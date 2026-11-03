<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Save workout as plan

- **Plan**: context/changes/save-workout-as-plan/plan.md
- **Scope**: Full plan (3 of 3 phases)
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Focus and live region lost when the form closes

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/SaveAsPlan.tsx:36-45, :102
- **Detail**: When the form unmounts (Cancel or successful save) the focused button disappears and focus falls to body. The success `role="status"` element is created together with its text, which many screen readers do not announce.
- **Fix**: Move focus to the "View plan" link after save and back to the "Save as plan" button after Cancel; keep an always-mounted `role="status"` container.
  - Strength: Keyboard and screen-reader users keep their place and hear the result.
  - Tradeoff: A couple of refs and effects in the component.
  - Confidence: HIGH — a standard pattern, one component.
  - Blind spot: Not checked with a real screen reader.
- **Decision**: FIXED (2026-11-03)

### F2 — Duplicate focus rule and override of shared button primitive

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/page.css:169-178
- **Detail**: `.save-as-plan .btn-*:focus-visible` repeats the global rule at page.css:234-235. `.save-as-plan .btn-primary` overrides the shared primary button's width/padding with literal rem values.
- **Fix**: Delete the duplicated focus-visible rule; keep only the layout override (or move it into a shared modifier class).
- **Decision**: FIXED (2026-11-03)

### F3 — Missing test coverage for the failure path and edge cases

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/e2e/save-workout-as-plan.spec.ts
- **Detail**: Only the two happy paths are covered. Not covered: save failure (alert shown, form still usable), Cancel, dismissing the post-End panel, no panel after ending a zero-set workout, and the prefilled default name.
- **Fix**: Add e2e cases for the failure path (route the POST to a 500), the default name prefill, and "no panel for an empty workout".
  - Strength: Protects the user-visible behaviours most likely to regress.
  - Tradeoff: A few more seconds of e2e time; the failure test needs request mocking.
  - Confidence: HIGH — mocking pattern already used in workout-ui.spec.ts.
  - Blind spot: None significant.
- **Decision**: FIXED (2026-11-03)

### F4 — Silent truncation of very large workouts

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/utils/workoutToPlan.ts:43-46
- **Detail**: Workouts over 50 exercise runs, or runs over 20 sets, are clipped without telling the user. Accepted in the plan ("clamp to limits").
- **Fix**: Optionally show a short hint when truncation happens.
- **Decision**: FIXED (2026-11-03)

### F5 — Double-submit guard reads render-time state

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/SaveAsPlan.tsx:53-66
- **Detail**: Buttons are disabled while submitting, but two submit events before a re-render could both pass the `submitting` check. Realistic exposure is very low.
- **Fix**: Add a `useRef` in-flight flag.
- **Decision**: FIXED (2026-11-03)

### F6 — Post-End panel: ambiguous dismiss and no focus handling

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/WorkoutPage.tsx:259-267
- **Detail**: "Dismiss" hides the whole panel including the "Workout saved." message, and focus is not moved when the panel appears.
- **Fix**: Optional: rename to "Close" and focus the panel heading or button when it appears.
- **Decision**: FIXED (2026-11-03)

### F7 — Timezone-sensitive date assertion in unit test

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/utils/workoutToPlan.test.ts:58-59
- **Detail**: `'3 Nov 2026'` from `2026-11-03T10:00:00Z` depends on the runner's timezone; it would differ at UTC+14.
- **Fix**: Use a midday UTC timestamp or compare against `formatDate(...)` output.
- **Decision**: FIXED (2026-11-03)
