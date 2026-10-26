<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: User-Defined Training Plan

- **Plan**: context/changes/user-defined-training-plan/plan.md
- **Scope**: Full plan (Phases 1-6 of 6)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-10-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria re-run: `./mvnw test` 78 tests pass; `npm run lint` only the 2 pre-existing AuthContext.tsx warnings; `npm run build` passes. All Manual rows are checked and were confirmed by the user.

## Findings

### F1 — Deleted-plan race during session start returns 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutService.java:53-65
- **Detail**: If the plan is deleted between the ownership check and the insert, the FK violation is a DataIntegrityViolationException. The catch block assumes a unique-index race, finds no active session on re-read, and rethrows, giving an unmapped 500.
- **Fix**: In the catch's empty re-read branch, re-check the plan and throw PlanNotFoundException (404).
  - Strength: Keeps the existing race handling intact and turns a 500 into the documented 404.
  - Tradeoff: One extra query on a very rare path.
  - Confidence: HIGH — the failure path is visible in the code.
  - Blind spot: Not reproduced with a concurrent test.
- **Decision**: FIXED: re-check plan in the catch fallback and throw PlanNotFoundException (404)

### F2 — Concurrent plan replace can return 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/plan/TrainingPlanService.java:46-57
- **Detail**: Two concurrent PUTs on the same plan both clear and re-insert entries; the (plan_id, position) unique constraint makes one fail with an unmapped DataIntegrityViolationException. No data corruption, but a spurious 500 (e.g. double-submit from two tabs).
- **Fix A ⭐ Recommended**: Take a pessimistic write lock when loading the plan in replace.
  - Strength: Serializes concurrent replaces so both succeed in order; no new error path.
  - Tradeoff: Needs a lock-specific repository method.
  - Confidence: MED — standard JPA approach, not yet tried in this repo.
  - Blind spot: Lock behaviour not tested with Testcontainers.
- **Fix B**: Map DataIntegrityViolationException from replace to a 409 `{"error"}`.
  - Strength: Small change, explicit contract.
  - Tradeoff: The losing client must retry; handler must be scoped to avoid masking other errors.
  - Confidence: MED — depends on how narrowly it can be scoped.
  - Blind spot: Other constraint violations could be mislabelled.
- **Decision**: FIXED via Fix A: PESSIMISTIC_WRITE lock (findByIdAndUserIdForUpdate) used by replace

### F3 — Non-integer sets/reps are silently truncated

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/PlanEditorPage.tsx:93-95 (and PlanEntryRequest.java)
- **Detail**: "3.5" is sent as a JSON float; Jackson's default float-to-int coercion likely stores 3. Empty/NaN correctly become null and are rejected, but fractions pass.
- **Fix**: Send non-integer input as null (or the raw string) so the server returns 400, e.g. use Number.isInteger before sending.
- **Decision**: FIXED: toTarget sends null for non-integer input so the server rejects it

### F4 — list() loads entries per plan (N+1)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/plan/TrainingPlanService.java:27 and PlanSummaryResponse.java:9
- **Detail**: exerciseCount reads plan.getEntries().size(), one lazy load per plan. Acceptable at the PRD's scale (a handful of plans), but easy to avoid.
- **Fix**: Add @BatchSize on the entries collection or a count query projection for the summary.
- **Decision**: FIXED: @BatchSize(size = 50) on TrainingPlan.entries

### F5 — planId silently ignored when a session is already active

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutService.java:49-52
- **Detail**: Starting "from plan X" while a session from plan Y (or none) is active returns that session with 200. This is the planned behaviour (idempotent start), but a client cannot tell its request was ignored except by comparing planId.
- **Fix**: Keep as is and note it in the API docs, or return 409 when the requested planId differs from the active session's.
  - Strength: A 409 makes the mismatch explicit.
  - Tradeoff: Deviates from the plan and from S-01's idempotent-start contract.
  - Confidence: MED — depends on how the UI should behave on a stale idle page.
  - Blind spot: UI path that could hit this was not exercised.
- **Decision**: FIXED: 409 when a requested planId differs from the active session (no-body and same-plan starts stay idempotent); test updated

### F6 — Editor shows stale state when switching plan ids in-app

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/PlanEditorPage.tsx:110-142
- **Detail**: loading is not reset when `id` changes, so old entries remain until new data arrives when navigating between /plans/:id and /plans/new without unmounting.
- **Fix**: Reset loading/form at the top of the effect, or key the editor on the route id.
- **Decision**: FIXED: editor keyed on the route id (remounts on id change)

### F7 — Walk-through selection quirks

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/WorkoutPage.tsx:52-70, frontend/src/components/PlanWalkthrough.tsx:52
- **Detail**: (a) once all entries are done, selection is cleared and the user must re-pick an exercise to log extra sets; (b) a plan with the same exercise twice highlights both entries as selected (compares exerciseId, not entry); (c) the picker is briefly empty while getPlan loads.
- **Fix**: Keep the last selection after completion, highlight by entry index, and show a plan-loading state.
- **Decision**: FIXED (a) and (b): selection stays on the last entry after completion and highlight is per entry; (c) transient empty picker not addressed

### F8 — Circular package dependency and implicit error conventions

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/main/java/com/example/gymtrack/plan/TrainingPlanService.java:5, PlanExceptionHandler.java:10, WorkoutService.java:4
- **Detail**: plan imports workout.WorkoutNotFoundException while workout imports plan.PlanNotFoundException and TrainingPlanRepository. Also, malformed JSON bodies (non-UUID planId, string for sets) get Spring's default 400 body instead of `{"error": ...}`, and the malformed-UUID handling is implicit via the global workout handler.
- **Fix**: Leave as is for now (matches the S-01 logSet precedent) and record it; address with a shared not-found exception and an HttpMessageNotReadable handler when a third package needs it.
  - Strength: No churn in a working, tested change.
  - Tradeoff: Coupling grows with each new feature.
  - Confidence: MED — depends on upcoming slices (S-05, S-06).
  - Blind spot: Frontend may rely on the default 400 body shape.
- **Decision**: FIXED: added common.ResourceNotFoundException + CommonExceptionHandler (404 and malformed-body 400 in the error shape), removed plan to workout import and PlanExceptionHandler
