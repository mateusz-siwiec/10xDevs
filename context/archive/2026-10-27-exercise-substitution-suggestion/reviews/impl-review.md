<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Exercise Substitution Suggestion

- **Plan**: context/changes/exercise-substitution-suggestion/plan.md
- **Scope**: Full plan (Phases 1-2 of 2)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

Automated criteria re-run: `ExerciseControllerTest` 8/8, full suite 81/81, `npm run lint` (2 pre-existing warnings in AuthContext.tsx), `npm run build` OK.

## Findings

### F1 — Manual check 2.7 (phone-width layout) never confirmed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress row 2.7
- **Detail**: Row 2.7 is unticked; layout work was deliberately deferred to a later change. Archive will warn about it.
- **Fix**: Either check at ~360px width and tick it, or leave it and cover it in the follow-up layout change.
- **Decision**: SKIPPED — deferred to the layout change

### F2 — "Use this" button stretches to full row width

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/workout.css (.substitute-item), SubstituteSuggestions.tsx:87
- **Detail**: `.btn-primary` in page.css is `display:block; width:100%`. As a flex child beside `.substitute-item-info` it can squeeze the exercise name, especially on phones.
- **Fix**: Add `.substitute-item .btn-primary { width: auto; flex-shrink: 0; }`.
- **Decision**: FIXED — Fix now (width:auto override)

### F3 — Suggestion buttons and states not accessible

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/SubstituteSuggestions.tsx:48-100
- **Detail**: Every suggestion button reads "Use this", so screen-reader users hear identical buttons. Loading/error/empty states are not announced, and focus is not managed on open/close.
- **Fix**: Add `aria-label={`Use ${exercise.name}`}`, `role="status"` on the body (`role="alert"` on error), and `aria-labelledby` on the section. Focus management on open/close is optional.
  - Strength: Small edits in one component; no behaviour change.
  - Tradeoff: Focus management adds state; skip it if keeping scope tight.
  - Confidence: HIGH — standard patterns.
  - Blind spot: Not tested with a screen reader.
- **Decision**: FIXED — Fix now (aria-label, aria-live, role=alert, aria-labelledby; no focus management)

### F4 — Panel can reappear after plan auto-advance

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/WorkoutPage.tsx (render guard `substituteFor === selectedExercise`)
- **Detail**: `handleSelect` clears the panel, but selection changes caused by plan auto-advance only hide it; if the selection returns to the same exercise the panel reopens. Rare.
- **Fix**: Key the open-panel state to `{exerciseId, autoId}` like `manual`.
- **Decision**: SKIPPED — rare edge case

### F5 — Substitutes tests are seed-coupled and don't independently verify sort

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java:98-127
- **Detail**: `hasSize(3)` assumes exactly 4 chest exercises (consistent with existing tests). Expected order comes from the same DB-sorted repository method, so a wrong sort would not fail. No test pins the 400 for a malformed UUID.
- **Fix**: Compare against a Java-sorted copy of names and add a malformed-UUID 400 test.
- **Decision**: FIXED — Fix now (Java-sorted expectation, size derived from seed, malformed-UUID 400 test)

### F6 — Cosmetic CSS cleanup

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/workout.css:95,107
- **Detail**: `.exercise-picker-row` is declared twice, and `.exercise-unavailable` is a leftover name for the "Find substitute" button.
- **Fix**: Merge the two rules and rename the class to `find-substitute-btn`.
- **Decision**: FIXED — Fix now (merged rules, renamed to find-substitute-btn)
