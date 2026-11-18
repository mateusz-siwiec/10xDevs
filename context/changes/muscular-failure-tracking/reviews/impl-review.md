<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Track muscular failure on logged sets

- **Plan**: context/changes/muscular-failure-tracking/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-18
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Success criteria were verified in this session at the implementing commits (backend 233 tests, Vitest 63, build/lint/check:tokens, full e2e 80 passed); only plan/change.md edits followed.

## Findings

### F1 — Sleep-based ordering in new backend tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: HistoryControllerTest, PreviousWorkoutControllerTest, ProgressionRecommendationControllerTest (new `Thread.sleep(5/10)`)
- **Detail**: New tests order sets by `loggedAt` with short sleeps; a timestamp tie falls back to UUID order. The same sleep pattern already exists in these classes, so it is consistent, but still a mild flakiness risk.
- **Fix**: Set `loggedAt` explicitly or use a larger gap in the new tests.
- **Decision**: FIXED — sleep gap raised 5→20 ms in the two new ordering tests (still timing-based; third test unchanged)

### F2 — Negative margin coupled to grid gap

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/muscle-groups.css:101-107
- **Detail**: `.muscle-failure` uses `margin-top: -0.5rem` tied to the row grid gap; breaks if the layout changes. Passes check:tokens.
- **Fix**: Use `row-gap`/layout instead of a negative margin.
- **Decision**: FIXED — negative margin removed; `.muscle-row` now uses `column-gap: 0.75rem; row-gap: 0.25rem` (same effective spacing). check:tokens and muscle-group-stats e2e pass

### F3 — Unasserted API setup posts in e2e

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/e2e/muscle-group-stats.spec.ts (set seeding)
- **Detail**: `request.post` results are not checked; a failed seed would show as a wrong count later. Existing seeding in this spec does the same.
- **Fix**: Assert `response.ok()` in the seeding helper.
- **Decision**: FIXED — `ok()` assertions added to the seeding posts in the new test (the pre-existing `logSets` helper left as is)

### F4 — Second checkbox style

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/page.css:97-135
- **Detail**: `.check-field` coexists with `.exercise-secondary-option`. States are complete; unify later if desired.
- **Fix**: Optional follow-up to unify checkbox styles.
- **Decision**: SKIPPED

### F5 — Boxed Boolean instead of primitive in LogSetRequest

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/main/java/com/example/gymtrack/workout/LogSetRequest.java
- **Detail**: Plan said primitive `boolean`; implementation uses `Boolean` with a compact constructor mapping null to false. Behaviour matches the contract (absent => false) and is more lenient. Acceptable; documented here.
- **Fix**: None needed.
- **Decision**: ACCEPTED — documented deviation, contract met

### F6 — Linux baselines not regenerated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/e2e/workout-ui.spec.ts-snapshots/
- **Detail**: Only win32 baselines were refreshed (as the plan allows); the plan requires calling out the Linux gap in the PR description.
- **Fix**: Mention in the PR description that Linux baselines need regenerating on Linux/CI.
- **Decision**: SKIPPED — remember to call out the Linux baseline gap in the PR description
