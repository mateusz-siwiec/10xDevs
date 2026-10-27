# Previous Workout Weight Hint Implementation Plan

## Overview

When a user trains from a plan, show them what they did for the selected exercise last time, per set. A new read-only endpoint `GET /api/exercises/{exerciseId}/previous-workout?planId=` returns the sets of that exercise from the most recent ended workout of the same plan that contains the exercise; a text panel on `WorkoutPage` shows them ("Last time (27 Oct): 5 × 40 kg, 10 × 60 kg, …"). Roadmap slice S-12, anchor MS-02.

## Current State Analysis

No frame or research doc exists; scope comes from the roadmap slice S-12 and the decisions taken in the planning interview.

- Sessions record only a nullable `planId` (`WorkoutSession.java`, `V7__add_workout_session_plan.sql`, `on delete set null`); free-form sessions and sessions of deleted plans have none, so they get no hint.
- Sets carry `exerciseId`, `reps`, `weightKg`, `loggedAt` (`WorkoutSet.java`); warm-up sets are ordinary sets (no flag). `SessionResponse` / `SetResponse` already expose them.
- The S-03 recommendation is the pattern to copy: `ProgressionController` + `ProgressionRecommendationService` (200 or 204), `WorkoutSessionRepository.findRecentEndedWithExercise` (user + exercise, newest ended first, with an `s.id desc` tiebreaker), and `ProgressionRecommendation.tsx` (cancelled-flag fetch keyed by exercise, silent on errors).
- `WorkoutPage` already knows the active session's plan (`sessionPlanId`) and renders the S-03 panel under the exercise picker, before `SetLogger`.
- Review lessons already applied elsewhere: keep a persistent `aria-live` wrapper so late-appearing hints are announced; add a deterministic tiebreaker to "newest" queries.

## Desired End State

During a workout started from a plan, selecting an exercise shows a "Last time" line with its sets from the previous workout of that plan, in the order they were logged, above the S-03 recommendation. Without a plan, without history, or on an error, nothing is shown. Verify: `./mvnw test` green with the new test class; `npm run build` and `npm run lint` clean; manual walkthrough below.

### Key Discoveries:

- "Previous workout" = the most recent **ended** session with the same `planId` that has sets of this exercise (a newer session of the plan without that exercise is skipped for that exercise).
- All sets of the exercise from that session are shown, in `loggedAt` order, warm-ups included.
- Hint only: `SetLogger` is not changed and nothing is prefilled.
- Endpoint pattern: `ProgressionController.java`; 204 pattern: `WorkoutController.current`; test setup: `ProgressionRecommendationControllerTest.java` (Testcontainers + MockMvc, repositories for fixtures, `Thread.sleep(10)` before each ended session to order `endedAt`).
- `/api/**` is authenticated by default (`SecurityConfig.java:48`).

## What We're NOT Doing

- No prefill of `SetLogger` and no change to it.
- No "working sets only" filtering or warm-up detection; all sets are shown.
- No hint for sessions without a plan, after the plan was deleted, or from a running session.
- No schema change, no snapshot of plan targets, no change to the S-03 recommendation or its panel.
- No history across different plans and no pagination; one previous workout per exercise and plan.

## Implementation Approach

A stateless backend lookup keyed by user, exercise and plan returns the sets of the last matching ended session (or 204). The frontend fetches it only when the active session has a `planId` and shows a small text panel; the panel is advisory, so loading, 204 and errors render nothing. Backend first so it is verifiable in isolation.

## Phase 1: Backend previous-workout endpoint

### Overview

Look up and expose the previous workout's sets for an exercise within a plan, with integration tests.

### Changes Required:

#### 1. Plan-scoped recent-session query

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java`

**Intent**: Find the user's most recent ended session of a given plan that contains a given exercise.

**Contract**: a `@Query` selecting `WorkoutSession` where `userId = :userId`, `planId = :planId`, `endedAt is not null`, and an `exists` over `WorkoutSet` for `:exerciseId`, ordered `endedAt desc, startedAt desc, id desc`, taking a `Pageable` (the service passes a page of size 1). Mirrors `findRecentEndedWithExercise`.

#### 2. Service and response

**File**: `src/main/java/com/example/gymtrack/workout/PreviousWorkoutService.java` (new), `PreviousWorkoutResponse.java` (new)

**Intent**: Return the exercise's sets from the previous workout of the plan.

**Contract**: `@Transactional(readOnly = true) Optional<PreviousWorkoutResponse> find(UUID userId, UUID exerciseId, UUID planId)`; unknown exercise → `WorkoutNotFoundException("Exercise not found")` (as `WorkoutService.progression`). Response record `{ exerciseId, sessionId, endedAt, sets }` where `sets` is a list of `{ reps, weightKg }` in `loggedAt` order, filtered to the exercise (sets of other exercises in that session are excluded). No matching session → empty.

#### 3. Endpoint

**File**: `src/main/java/com/example/gymtrack/workout/PreviousWorkoutController.java` (new)

**Intent**: Serve the lookup to the authenticated user only.

**Contract**: `GET /api/exercises/{exerciseId}/previous-workout?planId=<uuid>` → `200` with the response record, or `204` with no body. `planId` is required: a malformed value returns 400 `{"error": ...}` via the existing type-mismatch handler; a missing value returns 400 (the body shape for a missing parameter is not asserted). The user id comes from `@AuthenticationPrincipal CurrentUser`. A `planId` that is not the caller's simply matches no sessions (204).

#### 4. Tests

**File**: `src/test/java/com/example/gymtrack/workout/PreviousWorkoutControllerTest.java` (new)

**Intent**: Pin every branch of the lookup, including the interview's edge cases.

**Contract**: Testcontainers + MockMvc setup as in `ProgressionRecommendationControllerTest`; create plans via `TrainingPlanRepository` and sessions/sets via repositories. Cases: previous session returns all its sets of the exercise in logged order including a lighter warm-up first; sets of other exercises in that session are excluded; the newest session of the plan without the exercise is skipped in favour of an older one with it; only the most recent matching session is returned when several qualify; sessions of another plan are ignored; a free-form session (no plan) is ignored; a running session is ignored; another user's sessions never leak (including a session of theirs that carries the same `planId`); no history → 204 with an empty body; malformed `planId` → 400 with an `error`; missing `planId` → 400; unknown exercise → 404; no token → 401.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `./mvnw test`
- New test class passes on its own: `./mvnw test -Dtest=PreviousWorkoutControllerTest`

#### Manual Verification:

- With the `local` profile and a real token: after one ended workout from a plan with a warm-up and working sets, the endpoint returns all of them in order
- For an exercise never done with that plan, or without a `planId`, it returns 204 / 400 as specified

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend "Last time" panel

### Overview

Show the previous workout's sets next to the selected exercise during a plan workout.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to the endpoint, treating 204 as "no previous workout".

**Contract**: `interface PreviousWorkout { exerciseId: string; sessionId: string; endedAt: string; sets: { reps: number; weightKg: number }[] }` and `getPreviousWorkout(exerciseId: string, planId: string): Promise<PreviousWorkout | null>` modelled on `getProgressionRecommendation` (204 → null).

#### 2. Panel component

**File**: `frontend/src/components/PreviousWorkoutHint.tsx` (new), `frontend/src/styles/workout.css`

**Intent**: Render an advisory "Last time" line; stay out of the way otherwise.

**Contract**: props `{ exerciseId: string; planId: string }`. Fetch on `exerciseId`/`planId` change with the cancelled-flag pattern of `ProgressionRecommendation.tsx`; keep the result keyed by `exerciseId:planId` so a stale response is never shown. Always render a persistent `<div aria-live="polite">`; inside it, only when a result with at least one set exists, a section "Last time ({d MMM of endedAt}): {reps} × {weightKg} kg, …" using the same `reps × weight kg` format as `SessionSetList`. Loading, `null` and errors render nothing (advisory). Styled with the existing panel look (same as `.progression-recommendation` or a small shared class in `workout.css`).

#### 3. Page wiring

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Show the hint above the S-03 recommendation, only for plan sessions.

**Contract**: render `<PreviousWorkoutHint exerciseId={selectedExercise} planId={sessionPlanId} />` when `selectedExercise` and `sessionPlanId` are both set, immediately before `<ProgressionRecommendation …>`; no other state changes.

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Start a workout from a plan that has a finished earlier workout: selecting an exercise shows "Last time (date): …" with every set in logged order, above the "Try X kg" line when both apply
- A free-form workout, an exercise not done in the previous workout of the plan, or a plan without history shows no hint
- Switching exercises updates or hides the hint; an error leaves the workout screen fully usable
- Layout is usable at phone width

---

## Testing Strategy

### Unit Tests:

- The lookup is exercised through the integration tests in Phase 1 (thin logic, no separate unit layer).

### Integration Tests:

- `PreviousWorkoutControllerTest` (Phase 1) over real Postgres via Testcontainers.

### Manual Testing Steps:

1. Create a plan with one exercise; run and end a workout from it with a warm-up (5 × 40 kg) and three working sets (10 × 60 kg).
2. Start a second workout from the same plan and select the exercise → "Last time (…): 5 × 40 kg, 10 × 60 kg, 10 × 60 kg, 10 × 60 kg".
3. Start a free-form workout → no hint.
4. Delete the plan and check an old workout of it no longer produces a hint.

## Performance Considerations

One bounded query (size-1 page) plus one set load per request; negligible at the PRD's data volume. No caching.

## Migration Notes

None — no schema changes. Known limitation: sessions lose their plan when it is deleted, so their history stops feeding the hint.

## References

- Roadmap: `context/foundation/roadmap.md` (S-12, MS-02)
- Similar implementation: `src/main/java/com/example/gymtrack/workout/ProgressionController.java`, `ProgressionRecommendationService.java`, `frontend/src/components/ProgressionRecommendation.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend previous-workout endpoint

#### Automated

- [x] 1.1 Backend tests pass: `./mvnw test`
- [x] 1.2 New test class passes on its own: `./mvnw test -Dtest=PreviousWorkoutControllerTest`

#### Manual

- [x] 1.3 After one ended plan workout with a warm-up and working sets, the endpoint returns all of them in order
- [x] 1.4 For an exercise never done with that plan, or without a planId, the endpoint returns 204 / 400 as specified

### Phase 2: Frontend "Last time" panel

#### Automated

- [ ] 2.1 Frontend builds: `cd frontend && npm run build`
- [ ] 2.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [ ] 2.3 Selecting an exercise in a second workout of the plan shows "Last time" with every set in logged order, above the "Try X kg" line when both apply
- [ ] 2.4 A free-form workout, an exercise not in the previous workout, or a plan without history shows no hint
- [ ] 2.5 Switching exercises updates or hides the hint; an error leaves the workout screen fully usable
- [ ] 2.6 Layout is usable at phone width
