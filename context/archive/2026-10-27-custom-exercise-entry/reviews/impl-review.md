<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Custom Exercise Entry

- **Plan**: context/changes/custom-exercise-entry/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated: `./mvnw test` exit 0; `npm run build` and `npm run lint` pass (2 existing warnings in AuthContext.tsx). Manual items 1.3-1.4, 2.3-2.4, 3.3-3.6 are checked, and the user confirmed phase 3 by hand. No privacy leak was found on any path that accepts an exercise id.

## Findings

### F1 — Concurrent create/delete returns 500 instead of 409

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseService.java:46-67
- **Detail**: The duplicate-name check and the used-in-plan/set check run before the write and are not atomic. Two simultaneous creates with the same name hit the unique index and surface as an unhandled DataIntegrityViolationException (500). A delete racing with a plan save or logged set hits the FK and also returns 500.
- **Fix**: Use saveAndFlush / flush inside try-catch and rethrow DataIntegrityViolationException as ExerciseConflictException (same messages as today).
  - Strength: Keeps the explicit pre-checks for friendly messages and adds a safety net.
  - Tradeoff: Small code addition; the production DB has no unique index (see F2), so create races still produce duplicates there.
  - Confidence: HIGH — the handler and exception already exist.
  - Blind spot: Not reproduced under real concurrency.
- **Decision**: FIXED (Fix now): flush + catch DataIntegrityViolationException -> 409 in ExerciseService create/delete

### F2 — Production schema lacks V8's FK, cascade and unique index

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/resources/db/migration/V8__add_exercise_owner.sql / Exercise.java
- **Detail**: Production runs ddl-auto=update with Flyway off, so only the plain owner_id column is created there. The FK to users with on delete cascade, the owner_id index and the partial unique index (owner_id, lower(name)) exist only locally and in tests. The plan documents this in Migration Notes, so the service check is the only duplicate guard in production.
- **Fix**: Apply the V8 statements to the production database by hand and add a note to the deploy docs.
  - Strength: Makes production match tested behaviour, including the guard F1 relies on.
  - Tradeoff: A manual step outside the repo.
  - Confidence: MEDIUM — depends on how you manage the Supabase schema.
  - Blind spot: Existing production data was not inspected.
- **Decision**: FIXED (Fix now): manual-prod-step note added to CLAUDE.md; the SQL itself still has to be run by the user

### F3 — Failed load shows "No custom exercises yet."

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/MyExercisesPage.tsx (list render)
- **Detail**: If getExercises fails, the error is shown but the empty-state text renders under it, which is misleading.
- **Fix**: Do not render the empty state while a load error is set.
- **Decision**: FIXED (Fix now): separate loadFailed flag hides the empty state

### F4 — Live region wraps the whole list; no focus management

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/MyExercisesPage.tsx (section aria-live)
- **Detail**: aria-live="polite" covers the list including Confirm/Cancel buttons, so screen readers may re-announce it on each change. Focus is also lost when Delete swaps to Confirm/Cancel. The plan asked for a persistent aria-live region, and PlansPage has the same swap.
- **Fix**: Leave as is for consistency with the plan, or narrow the live region to a status message.
- **Decision**: SKIPPED (kept consistent with plan and PlansPage)

### F5 — Unscoped exercise finders left in ExerciseRepository

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseRepository.java:13-17
- **Detail**: findAllByOrderByNameAsc and the two muscle-group finders ignore ownership. Main code no longer calls them (the drift check found existing tests still use them), but reuse would leak private exercises.
- **Fix**: Migrate the tests to the visible variants and delete the unscoped finders.
- **Decision**: SKIPPED

### F6 — Stale Javadoc on ExerciseResponse

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseResponse.java:7-8
- **Detail**: Still says "Response shape for a catalog exercise" although it now also covers custom exercises.
- **Fix**: Update the comment.
- **Decision**: FIXED (Fix now): Javadoc updated
