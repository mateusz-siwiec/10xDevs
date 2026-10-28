<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Personal Record Flag

- **Plan**: context/changes/personal-record-flag/plan.md
- **Scope**: Full plan (2 of 2 phases)
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria run during review: `./mvnw test -Dtest=PersonalRecordControllerTest` 8/8, `./mvnw test` 162/162, `npm run lint` (2 pre-existing warnings in AuthContext.tsx), `npm run build` OK. Manual items 1.3, 1.4, 2.3–2.7 were confirmed by the user.

## Findings

### F1 — Delete refetch can overwrite a set logged while it is in flight

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/WorkoutPage.tsx:181-195 (handleDelete), :285 (SetLogger not disabled while busy)
- **Detail**: After a successful delete, handleDelete calls getCurrentSession() and replaces the whole session with the result. SetLogger is only disabled when no exercise is selected, not while busy. If the user logs a set while the refetch is in flight and the refetch was served before that log committed, the new set disappears from the UI until reload (progress and set-number hints go wrong with it). Two quick deletes can also apply an older snapshot over a newer one.
- **Fix A ⭐ Recommended**: Merge only the flags from the refetch into the current state (match by set id, keep local membership).
  - Strength: The server stays the source of truth for flags and local set membership is never clobbered; no UI blocking needed.
  - Tradeoff: A few lines of merge logic in handleDelete.
  - Confidence: HIGH — only the flags can change after a delete; membership is already correct locally.
  - Blind spot: A set logged during the refetch keeps its own server-returned flag, which is correct because appends never change earlier flags.
- **Fix B**: Disable SetLogger while busy.
  - Strength: One-prop change; removes the interleaving entirely.
  - Tradeoff: Blocks logging during every delete round trip and does not cover two overlapping deletes.
  - Confidence: MEDIUM — depends on whether the brief logging freeze is acceptable mid-workout.
  - Blind spot: Does not fix the snapshot ordering between two fast deletes.
- **Decision**: FIXED via Fix A (flags merged by set id in WorkoutPage.handleDelete)

### F2 — Set ordering has no tiebreaker

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java:17 (findBySessionIdOrderByLoggedAtAsc)
- **Detail**: Two sets with an identical loggedAt would be ordered arbitrarily, so a flag could in theory differ between logSet, the live view and history detail. Practically unlikely at microsecond precision.
- **Fix**: Order by loggedAt then id (OrderByLoggedAtAscIdAsc), or accept the risk.
- **Decision**: FIXED (finder renamed to findBySessionIdOrderByLoggedAtAscIdAsc, all callers updated)

### F3 — Misleading arithmetic comment in a test

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/test/java/com/example/gymtrack/workout/PersonalRecordControllerTest.java:143-145
- **Detail**: The comment "Would not beat the 20-rep score (60 x 36 = 2160 < 3000) if it had raised the baseline" is correct but confusingly worded; the assertion is right (2160 beats the 2100 baseline).
- **Fix**: Reword to "Beats the 5-rep baseline (2160 > 2100); it would not have beaten the 20-rep score (3000) had that raised the baseline."
- **Decision**: FIXED (comment reworded)
