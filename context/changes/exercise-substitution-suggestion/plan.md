# Exercise Substitution Suggestion Implementation Plan

## Overview

Let a user mark the exercise they are about to log as unavailable and see up to three suggested substitutes from the same primary muscle group (FR-012). The rule lives in a new read-only backend endpoint; the workout page gets an "Unavailable" action that shows the suggestions. Accepting a suggestion switches the logging target to it. It is a suggestion only: nothing is swapped automatically and nothing is persisted.

## Current State Analysis

- The catalog is seeded (V2 migration, 40 exercises, 4 per primary group) and each `Exercise` carries `primaryMuscleGroup` plus a set of secondary groups.
- `ExerciseRepository` already has `findByPrimaryMuscleGroupOrderByNameAsc` and `ExerciseController` exposes `GET /api/exercises` with an optional `muscleGroup` filter.
- `WorkoutPage.tsx` holds the selected exercise (auto-selected from the plan, or picked manually via `handleSelect`) and logs sets against it. It has no concept of an "unavailable" exercise.
- Plan progress is computed per plan entry by `exerciseId` (`planProgress.ts`), so sets logged against a substitute do not advance the skipped entry.
- Backend rules follow a controller-per-resource pattern with `@AuthenticationPrincipal CurrentUser`; unknown resources throw `ResourceNotFoundException`, mapped to 404 by `CommonExceptionHandler`.

## Desired End State

During an active session the user can press "Unavailable" for the selected exercise and sees up to three alternatives with the same primary muscle group, ordered by name. Pressing "Use this" on one selects it in the set logger and progression chart. Dismissing the panel, or changing the selected exercise, hides the suggestions. `GET /api/exercises/{id}/substitutes` returns the full ordered list and is covered by integration tests.

### Key Discoveries:

- `src/main/java/com/example/gymtrack/exercise/ExerciseRepository.java:11` already queries by primary group ordered by name; only an "exclude self" step is missing.
- `src/main/java/com/example/gymtrack/exercise/ExerciseController.java:17` is the existing catalog endpoint; the new route belongs beside it.
- `src/main/java/com/example/gymtrack/workout/ProgressionController.java:20` shows the `/api/exercises/{exerciseId}/...` sub-resource convention.
- `frontend/src/pages/WorkoutPage.tsx:73` `handleSelect` already switches the logging target and records a manual pick; accepting a substitute reuses it unchanged.
- The F-02 plan decided that substitution uses the primary group only; secondary groups carry no weighting.

## What We're NOT Doing

- Persisting "unavailable" or skipped state (S-06 owns real skip/return state).
- Mapping a substitute onto the skipped plan entry or changing plan progress logic.
- Equipment, movement-pattern, or user-history ranking; suggestions are ordered by name only.
- Using secondary muscle groups.
- Automatic swaps, or any change to saved plans.

## Implementation Approach

Two phases, backend first so the UI has a tested contract to consume. The endpoint is stateless and user-agnostic (the catalog is global), but sits behind the existing authentication like the rest of `/api/**`. The UI keeps suggestion state local to the workout page and clears it whenever the selected exercise changes.

## Phase 1: Backend substitutes endpoint

### Overview

Expose the substitution rule as `GET /api/exercises/{id}/substitutes`.

### Changes Required:

#### 1. Repository query

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseRepository.java`

**Intent**: Find catalog exercises that share a primary group with a given exercise, excluding that exercise, in a stable order.

**Contract**: `List<Exercise> findByPrimaryMuscleGroupAndIdNotOrderByNameAsc(MuscleGroup primaryMuscleGroup, UUID id)`.

#### 2. Controller route

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseController.java`

**Intent**: Resolve the exercise (404 if unknown), then return its same-group alternatives as `ExerciseResponse`s.

**Contract**: `GET /api/exercises/{exerciseId}/substitutes` → `200 List<ExerciseResponse>` ordered by name, never containing the requested exercise; unknown id → 404 via `ResourceNotFoundException`; unauthenticated → 401 (existing security config). The response is the full list; the "up to 3" cap is a UI concern.

#### 3. Integration tests

**File**: `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java`

**Intent**: Cover the rule, following the file's existing Testcontainers/MockMvc setup.

**Contract**: Tests for: requires token (401); returns the 3 other exercises of the same primary group for a seeded exercise, all with that primary group and none equal to the requested id; result is sorted by name; unknown UUID → 404.

### Success Criteria:

#### Automated Verification:

- New and existing exercise controller tests pass: `./mvnw test -Dtest=ExerciseControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the `local` profile running, an authenticated `GET /api/exercises/{id}/substitutes` for a seeded exercise returns three same-group exercises and not the requested one.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend suggestion UI

### Overview

Add the "Unavailable" action and a suggestions panel to the workout page.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Add a typed call to the new endpoint, following the existing `authFetch` helpers.

**Contract**: `getSubstitutes(exerciseId: string): Promise<Exercise[]>` → `GET /api/exercises/${exerciseId}/substitutes`.

#### 2. Suggestions component

**File**: `frontend/src/components/SubstituteSuggestions.tsx` (new)

**Intent**: Fetch and display up to three substitutes for the given exercise, each with a "Use this" action, plus a dismiss control. Handle loading, error and empty states in the style of `ProgressionChart` (including dropping stale responses on exercise change).

**Contract**: `{ exerciseId: string; onAccept: (exerciseId: string) => void; onDismiss: () => void }`. Shows at most the first 3 results; empty result shows a short "no alternatives" message; touch targets are comfortably tappable per the NFRs.

#### 3. Workout page wiring

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Add an "Unavailable" button next to the exercise picker that reveals the panel for the selected exercise. Accepting calls the existing `handleSelect` and closes the panel. The panel is hidden when no exercise is selected and is cleared whenever the selected exercise changes or the session ends.

**Contract**: Local state holds the exercise id the panel is open for; the panel renders only while that id equals the current `selectedExercise`. No changes to `planProgress.ts` or plan walkthrough behaviour.

#### 4. Styles

**File**: `frontend/src/styles/workout.css`

**Intent**: Style the button and panel consistently with existing workout sections, usable at phone width.

**Contract**: New classes only; reuse existing tokens (`--border`, `--accent`) and button classes.

### Success Criteria:

#### Automated Verification:

- Frontend lint passes: `npm run lint` (from `frontend/`)
- Frontend type-check and build pass: `npm run build` (from `frontend/`)

#### Manual Verification:

- In an active session, pressing "Unavailable" shows up to three same-group suggestions for the selected exercise, ordered by name.
- "Use this" switches the set logger and progression chart to the substitute; sets logged then belong to the substitute.
- Dismissing, changing the selected exercise, or ending the workout hides the panel.
- In a plan session the skipped plan entry stays pending after accepting a substitute (documented behaviour).
- Layout is usable at phone width.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- No new frontend unit-test framework exists in the repo; frontend verification is lint + build + manual.

### Integration Tests:

- Backend substitutes endpoint: auth, correct same-group set, exclusion of self, name ordering, unknown id.

### Manual Testing Steps:

1. Start a workout, select Bench Press (or any seeded exercise), press "Unavailable", confirm suggestions are all in the same primary group.
2. Accept one, log a set, confirm it appears under the substitute's name in "Logged sets".
3. Start a plan session, skip an entry via "Unavailable" + accept, confirm the entry remains pending.
4. Reload the page and confirm the panel is closed (state is not persisted).

## Performance Considerations

One small indexed-by-group query per request over a 40-row table; no caching needed.

## Migration Notes

None. No schema changes.

## References

- PRD: `context/foundation/prd.md` (FR-012, Business Logic)
- Roadmap: `context/foundation/roadmap.md` (S-04)
- Catalog decisions: `context/archive/2026-10-22-exercise-catalog-seed/plan.md:57`
- Similar sub-resource endpoint: `src/main/java/com/example/gymtrack/workout/ProgressionController.java:20`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend substitutes endpoint

#### Automated

- [x] 1.1 New and existing exercise controller tests pass — fe59d7d
- [x] 1.2 Full backend suite passes — fe59d7d

#### Manual

- [x] 1.3 Authenticated substitutes request returns three same-group exercises excluding the requested one — fe59d7d

### Phase 2: Frontend suggestion UI

#### Automated

- [x] 2.1 Frontend lint passes — 76c0075
- [x] 2.2 Frontend type-check and build pass — 76c0075

#### Manual

- [x] 2.3 Unavailable shows up to three same-group suggestions ordered by name — 76c0075
- [x] 2.4 Use this switches the logger and chart to the substitute — 76c0075
- [x] 2.5 Dismissing, changing exercise, or ending the workout hides the panel — 76c0075
- [x] 2.6 Skipped plan entry stays pending after accepting a substitute — 76c0075
- [ ] 2.7 Layout is usable at phone width
