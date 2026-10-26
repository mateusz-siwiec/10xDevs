<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Core Workout Logging Loop

- **Plan**: context/changes/core-workout-logging-loop/plan.md
- **Scope**: Full plan (Phases 1-5 of 5)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-26
- **Verdict**: APPROVED
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

Success criteria re-run: `./mvnw test` 51/51 pass; `npm run lint` 0 errors (2 pre-existing AuthContext warnings); `npm run build` OK.

## Findings

### F1 — Frontend handlers use stale session snapshot and don't set busy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/WorkoutPage.tsx:72, :85 (handleLog/handleDelete)
- **Detail**: After an await, `setSession({ ...session, sets: [...] })` builds from the `session` captured when the handler started. Two quick log/delete actions can overwrite each other, and a late response can resurrect an ended session. `handleLog`/`handleDelete` also don't set `busy`, so "End workout" stays enabled while they are in flight.
- **Fix**: Use functional `setSession(s => s && {...s, sets: ...})` and set `busy` during log/delete.
  - Strength: Small, local change; removes lost-update and end-vs-log interleaving in the UI.
  - Tradeoff: Slightly more state handling in the page.
  - Confidence: HIGH — standard React pattern.
  - Blind spot: Not reproduced in a browser.
- **Decision**: FIXED (functional setSession guarded by session id; busy set during log/delete)

### F2 — logSet/end/deleteSet check-then-act race on ended sessions

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutService.java:65-100
- **Detail**: The session is read without a lock; a set can be inserted just after a concurrent `end` commits, landing on an ended session. Requires one user racing themselves (e.g. two tabs), so low likelihood.
- **Fix A ⭐ Recommended**: Accept the risk and note it in the plan/follow-ups.
  - Strength: No added complexity for a single-user, small-scale MVP.
  - Tradeoff: Rare inconsistent state remains possible.
  - Confidence: MED — depends on how much the PRD cares about this edge.
  - Blind spot: No test of real concurrency.
- **Fix B**: Add a `@Lock(PESSIMISTIC_WRITE)` finder for the session in logSet/end/deleteSet.
  - Strength: Closes the race fully.
  - Tradeoff: New repository method and lock semantics to test.
  - Confidence: MED — straightforward but untested here.
  - Blind spot: Lock behavior with the existing TransactionTemplate retry path.
- **Decision**: ACCEPTED via Fix A (risk accepted: requires one user racing themselves; no lock added)

### F3 — 0.5 step rule only enforced in service, ordered after 404/409

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: LogSetRequest.java:21, WorkoutService.java:84, V4__create_workout_sessions_and_sets.sql:19
- **Detail**: A bad step sent to an ended session returns 409 rather than 400; no DB constraint for the step. This follows the plan ("step enforced in the service").
- **Fix**: Leave as planned, or move to a custom constraint.
- **Decision**: FIXED (new @HalfKgStep bean-validation constraint on weightKg; service check and InvalidWeightException removed; step now returns 400 before 404/409 checks)

### F4 — Malformed UUID path variable gives default Spring 400 body

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: WorkoutController.java (@PathVariable UUID)
- **Detail**: Not in the `{"error": ...}` shape used elsewhere.
- **Fix**: Handle MethodArgumentTypeMismatchException in the exception handler.
- **Decision**: FIXED (handler for MethodArgumentTypeMismatchException returning {"error":"Invalid <param>"}; test added)

### F5 — Validation handler lives in AuthExceptionHandler

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutExceptionHandler.java:9-12
- **Detail**: Workout 400s from bean validation depend on a handler named for auth.
- **Fix**: Rename/move to a neutral GlobalExceptionHandler when convenient.
- **Decision**: SKIPPED (touches user package, outside this change)

### F6 — startOrGetActive retry rethrows original exception if row vanished

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: WorkoutService.java:44-58
- **Detail**: Retry path is untested; if the active session ended between attempts the user gets a 500.
- **Fix**: Add a test (or loop once more) for the retry path.
- **Decision**: FIXED (concurrentStartsYieldOneCreatedAndSameSession test; verified it goes red when the retry catch is disabled)
