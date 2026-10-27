# Progression Recommendation Implementation Plan

## Overview

Implement FR-011 (roadmap S-03): while logging a workout, the user sees a recommendation to increase the weight for the selected exercise once they completed all working sets at full reps in their last N workouts of that exercise. A new read-only endpoint `GET /api/exercises/{exerciseId}/progression-recommendation` evaluates the rule server-side; a text panel on `WorkoutPage` shows the result. N = 2 and the increase is 2.5%, rounded to 0.5 kg (PRD Open Question 1 settled with a tunable default).

## Current State Analysis

No frame or research doc exists for this change; scope comes from the roadmap slice S-03 and `prd.md` FR-011, with the decisions below taken in the planning interview.

- "Full reps" needs a target (`sets × reps`). Targets exist only on `training_plan_entries` (`TrainingPlanEntry.java`: `sets`, `reps`). A session knows only a nullable `planId` (`V7__add_workout_session_plan.sql`, `on delete set null`); there is no per-session snapshot of targets.
- Editing a plan replaces its entries (`TrainingPlanService.java:54-56`, `TrainingPlan.replaceEntries`), so targets are read at evaluation time and old sessions are re-judged against the current plan.
- Sessions without a plan have no target. At most one active session per user; `endedAt` is null until ended (`WorkoutSession.java`).
- Weights are logged in 0.5 kg steps (`HalfKgStepValidator.java`), `weight_kg` is `> 0` and `<= 1000`, `reps` is 1–100 (`V4__create_workout_sessions_and_sets.sql:18-19`). Warm-up sets are ordinary sets (no flag).
- The only per-exercise endpoint on sets today is max weight per session (`WorkoutSetRepository.java:17-24`, `ProgressionController.java`).
- The workout page already selects an exercise, hosts `ProgressionChart` and the S-04 `SubstituteSuggestions` panel (`WorkoutPage.tsx`).

## Desired End State

When an exercise is selected during a workout, a panel reads e.g. "Try 61.5 kg — you completed 3×10 at 60 kg in your last 2 workouts." when the rule holds, and nothing is shown otherwise. Verify: `./mvnw test` green with the new test class; `npm run build` and `npm run lint` clean; manual walkthrough below.

### Key Discoveries:

- Target source: the plan entry of the session's `planId` for that exercise, read at evaluation time (no migration).
- Rule inputs: the N = 2 most recent **ended** sessions of the user that contain the exercise; a session with no target breaks the streak.
- Working sets: per session, the sets of that exercise at the session's highest weight; the highest weight must be the same in both sessions.
- Endpoint pattern to copy: `ProgressionController.java` + `WorkoutService.progression` (404 for an unknown exercise via `WorkoutNotFoundException`); 204-for-nothing precedent in `WorkoutController.current` and `getCurrentSession` in `client.ts`.
- Test setup to copy: Testcontainers + MockMvc as in `ProgressionControllerTest.java`; plans can be created through `TrainingPlanRepository` + `replaceEntries`.

## What We're NOT Doing

- No target snapshot per session and no migration; editing a plan re-judges old sessions (documented limitation).
- No fallback rule for sessions without a plan (no fixed rep threshold); they break the streak.
- No "Use this weight" button and no changes to `SetLogger`; the panel is text only and stores nothing (no dismiss state).
- No recommendation from a running session; only ended sessions count.
- No deload/recovery/injury logic (PRD: an intentionally simple heuristic, not a safety system).
- No user-configurable N or percentage; both are constants in one place so they can be tuned later.
- No recommendation on the dashboard or elsewhere.

## Implementation Approach

A stateless backend rule produces either a recommendation or "nothing" (204). The rule: take the N most recent ended sessions of the exercise; for each, find its target (session plan's first entry for the exercise by position, if any), isolate the working sets, check count and reps, and require the same top weight across all N sessions; then compute the recommended weight from that top weight. The frontend fetches it per selected exercise and renders a text panel; failures are silent because the panel is advisory.

## Phase 1: Backend rule and endpoint

### Overview

Evaluate the rule and expose it, with integration tests.

### Changes Required:

#### 1. Recent-sessions query

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java`

**Intent**: Fetch the user's most recent ended sessions that contain a given exercise, newest first, limited to N.

**Contract**: a `@Query` selecting `WorkoutSession` where `userId = :userId`, `endedAt is not null`, and an `exists` over `WorkoutSet` for `:exerciseId`, ordered by `endedAt desc` (tie-break `startedAt desc`), taking a `Pageable`/limit of N. Sets for the evaluation come from the existing `findBySessionIdOrderByLoggedAtAsc` (filter by exercise in code).

#### 2. Recommendation service

**File**: `src/main/java/com/example/gymtrack/workout/ProgressionRecommendationService.java` (new), `ProgressionRecommendationResponse.java` (new)

**Intent**: Apply the FR-011 heuristic and compute the suggested weight; keep the tunable constants in one place.

**Contract**: `@Transactional(readOnly = true) Optional<ProgressionRecommendationResponse> recommend(UUID userId, UUID exerciseId)`; unknown exercise → `WorkoutNotFoundException("Exercise not found")` (as `WorkoutService.progression`). Constants `REQUIRED_WORKOUTS = 2`, `INCREASE = 2.5%`. Response record: `{ exerciseId, currentWeightKg, recommendedWeightKg, workouts, targetSets, targetReps }` where target values come from the most recent session's target.

Rule, in order — any failure returns empty:
1. Fewer than N ended sessions of the exercise → empty.
2. Per session: target = the session plan's entry for the exercise (first by `position` if the exercise appears more than once); no `planId`, deleted plan, or exercise not in the plan → empty (breaks the streak, even if older sessions qualify).
3. Per session: working sets = the exercise's sets at the session's highest weight; qualifies only if `count >= target.sets` and every working set has `reps >= target.reps` (each session judged against its own target).
4. All N sessions must share the same highest weight; otherwise empty.
5. Recommended = highest weight × 1.025, rounded to the nearest 0.5 kg (half up), never less than highest + 0.5 kg; if the result exceeds 1000 kg → empty.

Worked boundaries to cover in tests: 60 kg → 61.5; 5 kg → 5.5 (min step); 10 kg → 10.5; 100 kg → 102.5.

#### 3. Endpoint

**File**: `src/main/java/com/example/gymtrack/workout/ProgressionController.java`

**Intent**: Serve the recommendation to the authenticated user only.

**Contract**: `GET /api/exercises/{exerciseId}/progression-recommendation` → `200` with the response record, or `204` with no body when there is no recommendation. Uses `@AuthenticationPrincipal CurrentUser`; already authenticated by the `/api/**` rule (`SecurityConfig.java:48`). Unknown exercise → 404 `{"error": ...}`.

#### 4. Tests

**File**: `src/test/java/com/example/gymtrack/workout/ProgressionRecommendationControllerTest.java` (new)

**Intent**: Pin every branch of the rule, including the interview's edge cases.

**Contract**: Testcontainers + MockMvc setup as in `ProgressionControllerTest`; build plans via `TrainingPlanRepository` and sessions/sets via repositories (end sessions in sequence so `endedAt` ordering is deterministic). Cases: two qualifying sessions at the same top weight → 200 with the expected weight; only one ended session → 204; the running session is ignored (qualifying history of one plus a running qualifying session → 204); one session short on sets → 204; one session with a rep below target → 204; warm-up sets at lighter weight do not break an otherwise qualifying session; different top weights across the two sessions → 204; an in-between session without a plan breaks the streak even though older sessions qualify; deleted plan (`planId` null) → 204; exercise absent from the plan → 204; rounding boundaries above; another user's sessions never leak; unknown exercise → 404; no token → 401.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `./mvnw test`
- New test class passes on its own: `./mvnw test -Dtest=ProgressionRecommendationControllerTest`

#### Manual Verification:

- With the `local` profile and a real token: after two ended plan workouts at full reps on the same weight, `GET /api/exercises/{id}/progression-recommendation` returns the expected weight
- With only one such workout, or after editing the plan so the target is no longer met, it returns 204

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend recommendation panel

### Overview

Show the recommendation next to the selected exercise.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to the endpoint, treating 204 as "no recommendation".

**Contract**: `interface ProgressionRecommendation { exerciseId: string; currentWeightKg: number; recommendedWeightKg: number; workouts: number; targetSets: number; targetReps: number }` and `getProgressionRecommendation(exerciseId: string): Promise<ProgressionRecommendation | null>` modelled on `getCurrentSession` (204 → null).

#### 2. Panel component

**File**: `frontend/src/components/ProgressionRecommendation.tsx` (new), `frontend/src/styles/workout.css`

**Intent**: Render an advisory sentence for the selected exercise; stay out of the way otherwise.

**Contract**: props `{ exerciseId: string }`. Fetch on `exerciseId` change using the cancelled-flag pattern of `SubstituteSuggestions.tsx`; keep the result keyed by `exerciseId` so a stale response for another exercise is never shown. Renders nothing while loading, on `null`, and on error (advisory only; never blocks logging). When present: "Try {recommendedWeightKg} kg — you completed {targetSets}×{targetReps} at {currentWeightKg} kg in your last {workouts} workouts." Styled with the existing panel look (`substitute-*` classes or a small new class in `workout.css`).

#### 3. Page wiring

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Place the panel under the exercise picker row for the selected exercise during an active session.

**Contract**: render `<ProgressionRecommendation exerciseId={selectedExercise} />` when `selectedExercise` is set, before `SetLogger`; no other state changes in the page.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- After two ended plan workouts at target on the same weight, selecting the exercise in a third workout shows the "Try X kg" sentence with the right numbers
- Switching exercises updates or hides the panel; a free-form workout (no plan) shows nothing
- A server error or an exercise without a recommendation leaves the workout screen fully usable
- Layout is usable at phone width

---

## Testing Strategy

### Unit Tests:

- The rule is exercised through the integration tests in Phase 1 (thin logic, no separate unit layer); rounding and boundary cases are listed there.

### Integration Tests:

- `ProgressionRecommendationControllerTest` (Phase 1) over real Postgres via Testcontainers.

### Manual Testing Steps:

1. Create a plan with one exercise at 3×10; run and end two workouts from it with 3 sets of 10 at 60 kg each.
2. Start a third workout from the plan and select the exercise → "Try 61.5 kg …".
3. Log a lighter warm-up set in a fresh pair of workouts → recommendation still appears.
4. Edit the plan to 4×10 → recommendation disappears.
5. Run a free-form workout between two qualifying ones → recommendation disappears.

## Performance Considerations

One bounded query (N = 2 sessions) plus their sets and plan entries per request; negligible at the PRD's data volume. No caching.

## Migration Notes

None — no schema changes. Known limitation to document: plan edits and plan deletion change how older sessions are judged, because targets are not snapshotted.

## References

- PRD: `context/foundation/prd.md` (FR-011, Open Question 1)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- Similar implementation: `src/main/java/com/example/gymtrack/workout/ProgressionController.java`, `WorkoutController.java` (`current`, 204 pattern), `frontend/src/components/SubstituteSuggestions.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend rule and endpoint

#### Automated

- [x] 1.1 Backend tests pass: `./mvnw test` — 0c40b66
- [x] 1.2 New test class passes on its own: `./mvnw test -Dtest=ProgressionRecommendationControllerTest` — 0c40b66

#### Manual

- [x] 1.3 After two qualifying ended plan workouts, the endpoint returns the expected recommended weight — 0c40b66
- [x] 1.4 With only one qualifying workout, or after a plan edit that raises the target, the endpoint returns 204 — 0c40b66

### Phase 2: Frontend recommendation panel

#### Automated

- [x] 2.1 Frontend builds: `cd frontend && npm run build`
- [x] 2.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [x] 2.3 Selecting the exercise in a third workout shows the "Try X kg" sentence with the right numbers
- [x] 2.4 Switching exercises updates or hides the panel; a free-form workout shows nothing
- [x] 2.5 A server error or a missing recommendation leaves the workout screen fully usable
- [x] 2.6 Layout is usable at phone width
