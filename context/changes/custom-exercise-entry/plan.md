# Custom Exercise Entry Implementation Plan

## Overview

Let a user add their own exercises (name, primary muscle group, optional secondary groups) on a new "My exercises" page and delete them while unused. Custom exercises are private: they appear in the user's pickers and substitutes, are usable in workouts and plans, and are invisible to everyone else. Roadmap slice S-05, PRD FR-003 (nice-to-have).

## Current State Analysis

No frame or research doc exists; scope comes from roadmap S-05, PRD FR-003 / Access Control and the planning interview.

- `exercises` is global seed data: `id`, unique non-null `slug`, `name`, `primary_muscle_group`, plus `exercise_secondary_muscle_groups` (`V2__create_exercises_and_seed.sql`). `Exercise` is a read-only entity with a protected constructor and getters only (`Exercise.java`).
- The only exercise endpoints are `GET /api/exercises[?muscleGroup=]` and `GET /api/exercises/{id}/substitutes` in `ExerciseController.java`; neither knows the caller. `ExerciseResponse` carries `id, slug, name, primaryMuscleGroup, secondaryMuscleGroups`.
- Exercise ids are accepted without any ownership check in `WorkoutService` (`logSet` `existsById` at line 96, `progression` at 119), `PreviousWorkoutService` (30), `ProgressionRecommendationService` (51) and `TrainingPlanService.loadExerciseNames` (`findAllById`, 78). With private exercises these lookups would let a user log or plan against someone else's custom exercise.
- `workout_sets.exercise_id` and `training_plan_entries.exercise_id` reference `exercises(id)` with no cascade (`V4`, `V5`), so deleting a used exercise fails at the database; the service must detect that case.
- Error mapping: `ResourceNotFoundException` (404, `PlanNotFoundException` and `WorkoutNotFoundException` extend it) via `CommonExceptionHandler`; 409 handlers are per package (`WorkoutExceptionHandler`); bean-validation failures already map to 400 `{"error": ...}` (`AuthExceptionHandler`).
- Frontend: `getExercises()` feeds the pickers on `WorkoutPage` and `PlanEditorPage`; `PlansPage` / `PlanEditorPage` are the pattern for a list + form page; `Topbar.tsx` holds the nav; `App.tsx` the routes.
- Test pattern: Testcontainers + MockMvc with repositories for fixtures (`ExerciseControllerTest`, `PreviousWorkoutControllerTest`); `/api/**` is authenticated by default.

## Desired End State

A "My exercises" link in the topbar opens `/exercises`: a form (name, primary muscle group, optional secondary groups) and the user's own custom exercises with a Delete action. A new custom exercise shows up immediately in the workout and plan pickers and in same-group substitutes, for its owner only. Duplicate names are refused, a used exercise cannot be deleted (clear message), and other users' custom exercises are never visible or usable. Verify: `./mvnw test` green with the new tests; `npm run build` and `npm run lint` clean; manual walkthrough below.

### Key Discoveries:

- Ownership is a nullable `owner_id` on `exercises` (null = catalog), so one table and every existing join keep working.
- Custom exercises get a generated slug `custom-<uuid>`, which keeps the existing unique non-null `slug` column as is.
- "Visible to a user" = `owner_id is null or owner_id = :userId`. Every lookup that takes an exercise id must use that rule and answer 404 otherwise (never 403 — do not reveal existence).
- Name uniqueness: trimmed, case-insensitive, checked against the whole catalog and the user's own exercises; other users' private names never collide (a partial unique index covers the own-name case at the database level, the service gives the friendly 409).
- Delete is refused when the exercise is referenced by a plan entry or a logged set; the check is explicit in the service (count queries), not by catching an FK violation.
- A user's custom exercises cascade away with the user row (`on delete cascade`), though no user deletion exists yet.

## What We're NOT Doing

- No rename or edit of custom exercises, and no inline "add exercise" inside the workout or plan pickers.
- No per-user cap on the number of custom exercises.
- No sharing of custom exercises between users and no promotion to the catalog.
- No change to catalog data or to how catalog exercises behave.
- No archive/soft-delete: a used exercise simply cannot be deleted.
- No change to progression, recommendation or history logic beyond the visibility rule.

## Implementation Approach

Backend first and in two steps so the privacy rule is verified before any UI exists: first the data model plus create/list/delete, then enforce the visibility rule in every existing exercise lookup. Finally a single "My exercises" page reusing the plans page patterns. The list endpoint stays the single source for pickers; it simply starts returning the caller's own exercises too, flagged with `custom: true`.

## Phase 1: Custom exercise data and API

### Overview

Schema, entity, repository, and the create / delete / list behaviour for custom exercises, with tests.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V8__add_exercise_owner.sql` (new)

**Intent**: Mark exercises as private to a user and prevent duplicate own names.

**Contract**: `alter table exercises add column owner_id uuid references users (id) on delete cascade;` an index on `owner_id`, and a partial unique index on `(owner_id, lower(name)) where owner_id is not null`. Catalog rows keep `owner_id` null. Production applies schema through `ddl-auto=update` with Flyway off (see `CLAUDE.md`); the entity mapping must therefore match the migration so both paths produce the same schema.

#### 2. Entity and repository

**File**: `src/main/java/com/example/gymtrack/exercise/Exercise.java`, `ExerciseRepository.java`

**Intent**: Create custom exercises and query what a user may see.

**Contract**: `Exercise` gets a nullable `ownerId` column, a getter, and a public factory/constructor for a custom exercise taking `(ownerId, name, primaryMuscleGroup, secondaryMuscleGroups)` that assigns the id and the slug `custom-<id>` itself (the entity currently has no generated id, so the id is assigned in code). Repository additions: list of exercises visible to a user (catalog plus own) ordered by name, with and without a primary-muscle-group filter; `findVisibleById(id, userId)`; a case-insensitive name-exists check over catalog plus the user's own; own exercises ordered by name; usage checks for plan entries and logged sets referencing an exercise (queries on `TrainingPlanEntry` / `WorkoutSet`, or `exists` queries in the respective repositories).

#### 3. Service, request/response, errors

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseService.java` (new), `CreateExerciseRequest.java` (new), `ExerciseResponse.java`, `ExerciseConflictException.java` (new), `ExerciseExceptionHandler.java` (new)

**Intent**: Business rules for create and delete.

**Contract**: `CreateExerciseRequest { name (not blank, trimmed length 1–60), primaryMuscleGroup (required), secondaryMuscleGroups (optional set, must not contain the primary group) }`. `create(userId, request)` → trims the name, rejects a case-insensitive duplicate of a catalog name or own name with `ExerciseConflictException` (409 `{"error": ...}`), saves and returns the response. `delete(userId, id)` → loads only the caller's own custom exercise (catalog, foreign or unknown → `ResourceNotFoundException("Exercise not found")`), refuses with `ExerciseConflictException("Exercise is used in a plan or a workout")` when referenced, otherwise deletes. `ExerciseResponse` gains `boolean custom` (`ownerId != null`); `slug` stays. `ExerciseExceptionHandler` maps `ExerciseConflictException` to 409 in the `{"error": ...}` shape.

#### 4. Controller

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseController.java`

**Intent**: Expose create/delete and make the list caller-aware.

**Contract**: `GET /api/exercises[?muscleGroup=]` now takes `@AuthenticationPrincipal CurrentUser` and returns catalog plus the caller's own, ordered by name (filter semantics unchanged); `POST /api/exercises` → 201 with the response; `DELETE /api/exercises/{id}` → 204. Invalid body → 400 via the existing validation mapping; malformed id → 400 via the existing type-mismatch handling. The substitutes endpoint is handled in Phase 2.

#### 5. Tests

**File**: `src/test/java/com/example/gymtrack/exercise/CustomExerciseControllerTest.java` (new)

**Intent**: Pin the create/delete/list rules.

**Contract**: Testcontainers + MockMvc as in `ExerciseControllerTest`. Cases: create returns 201 with `custom: true`, trimmed name, generated slug and the chosen primary/secondary groups; it then appears in the creator's `GET /api/exercises` (and under its `muscleGroup` filter) and does not appear for another user; blank, over-60 and missing-group requests → 400 with `error`; a secondary group equal to the primary → 400; a name equal (case-insensitive, with surrounding spaces) to a catalog exercise → 409; a duplicate of the user's own → 409; another user may reuse a name that a different user has privately; delete of an unused own exercise → 204 and it is gone; delete of one used in a plan → 409 and still listed; delete of one used in a logged set → 409; delete of a catalog exercise, of another user's exercise and of an unknown id → 404; no token → 401 for create and delete. Existing `ExerciseControllerTest` cases keep passing (they use users without custom exercises).

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `./mvnw test`
- New test class passes on its own: `./mvnw test -Dtest=CustomExerciseControllerTest`

#### Manual Verification:

- With the `local` profile and a real token, `POST /api/exercises` creates a custom exercise that then shows up in `GET /api/exercises` with `custom: true`
- A second account does not see it; `DELETE` removes it, and a duplicate or catalog-equal name is refused with 409

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Enforce visibility everywhere

### Overview

Make every existing lookup that takes an exercise id respect "catalog or own", including substitutes.

### Changes Required:

#### 1. Visibility in workout and plan paths

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutService.java`, `PreviousWorkoutService.java`, `ProgressionRecommendationService.java`, `src/main/java/com/example/gymtrack/plan/TrainingPlanService.java`

**Intent**: A user can only log, plan, chart or ask for hints on exercises they may see.

**Contract**: Replace the `existsById` / `findAllById` checks with the visible-to-user variants from Phase 1 (`existsVisible(id, userId)` or `findVisibleById`, and a visible-batch equivalent for `loadExerciseNames`). Another user's custom exercise answers exactly like an unknown id: 404 `Exercise not found` (`WorkoutNotFoundException` / `ResourceNotFoundException` as each path already throws). Behaviour for catalog and own exercises does not change. History and plan responses that show exercise names are unaffected because they only reference exercises the user already used.

#### 2. Caller-aware substitutes

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseController.java`, `ExerciseRepository.java`

**Intent**: Suggest same-group alternatives from the catalog plus the caller's own exercises.

**Contract**: `GET /api/exercises/{id}/substitutes` takes the caller, resolves the base exercise through the visible lookup (invisible → 404) and returns visible exercises of the same primary group excluding the base, ordered by name; other users' custom exercises never appear.

#### 3. Tests

**File**: `src/test/java/com/example/gymtrack/exercise/CustomExerciseVisibilityTest.java` (new)

**Intent**: Prove isolation on every path that accepts an exercise id.

**Contract**: A second user's custom exercise returns 404 for: logging a set, the progression series, the progression recommendation, the previous-workout hint, creating a plan with it as an entry, updating a plan to include it, and as the base of `/substitutes`; the same calls succeed for the owner (log a set, create a plan, see it in substitutes of a catalog exercise of the same group and not in those of another group; its progression returns an empty series). A user's own custom exercise never appears in another user's `/substitutes`. A plan that contains the owner's exercise still loads for the owner.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `./mvnw test`
- New test class passes on its own: `./mvnw test -Dtest=CustomExerciseVisibilityTest`

#### Manual Verification:

- With two accounts and the `local` profile, account B gets 404 when logging a set or saving a plan with account A's custom exercise id
- Account A still sees its custom exercise in substitutes of a same-group catalog exercise

---

## Phase 3: "My exercises" page

### Overview

A `/exercises` page to add and delete custom exercises, reachable from the topbar.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to create and delete, and the new `custom` flag.

**Contract**: add `custom: boolean` to the `Exercise` interface; `createExercise(input: { name: string; primaryMuscleGroup: string; secondaryMuscleGroups: string[] }): Promise<Exercise>` and `deleteExercise(id: string): Promise<void>` using `authFetch` like the plan functions; the 409 / 400 messages from the API must reach the caller (follow how `createPlan` surfaces errors).

#### 2. Page

**File**: `frontend/src/pages/MyExercisesPage.tsx` (new), `frontend/src/styles/exercises.css` (new)

**Intent**: Add and delete custom exercises.

**Contract**: Loads `getExercises()` and shows only `custom` ones in a list (name and muscle groups) with a Delete button that asks for confirmation (the pattern of `SessionSetList`) and removes the row on success. Add form: name (max 60), primary muscle group (select from the ten values already used by the catalog; reuse a shared list if one exists in the frontend, otherwise define it once), optional secondary groups (multi-select/checkboxes, the primary group excluded), submit creates the exercise and prepends/sorts it into the list and clears the form. API errors (duplicate name, used exercise) show inline with `role="alert"`; an empty list shows "No custom exercises yet."; the list sits in a persistent `aria-live="polite"` region; cancelled-flag loading as in the other pages; usable at phone width using `page-shell` / `page-card` styles.

#### 3. Route and nav

**File**: `frontend/src/App.tsx`, `frontend/src/components/Topbar.tsx`

**Intent**: Make the page reachable.

**Contract**: `<Route path="/exercises">` inside `RequireAuth` and an "Exercises" `NavLink` in the topbar after "Plans".

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Adding a custom exercise (with and without secondary groups) shows it in the list; it then appears in the workout picker and in the plan editor picker
- A duplicate name and a catalog name show the error inline; deleting an unused exercise removes it; deleting one used in a plan or workout shows the refusal and keeps it
- A second account does not see the exercise anywhere
- Layout is usable at phone width

---

## Testing Strategy

### Unit Tests:

- Thin logic, covered through the integration tests; no separate unit layer.

### Integration Tests:

- `CustomExerciseControllerTest` (Phase 1) and `CustomExerciseVisibilityTest` (Phase 2) over real Postgres via Testcontainers.

### Manual Testing Steps:

1. Register two accounts, A and B.
2. As A, add "Cable Wrist Curl" (BICEPS) on the Exercises page; check it in the workout picker and plan editor, log a set with it, and use it in a plan.
3. Try adding "cable wrist curl" again and "Barbell Row" — both refused.
4. Try deleting it (refused, it is used); add and delete a second, unused one.
5. As B, confirm neither exercise is visible in any picker or in substitutes.

## Performance Considerations

The list query adds one `owner_id` predicate and the usage checks are single `exists` queries on indexed columns; negligible at the PRD's data volume. No caching.

## Migration Notes

One additive migration (nullable `owner_id`, indexes); existing rows and all existing references are unaffected. Production schema is managed by `ddl-auto=update` with Flyway off, so the entity mapping must declare the column; the partial unique index exists only in the Flyway migration (local and tests), so the service-level duplicate check is the production guard. Rollback is dropping the column and indexes (no data loss for catalog data).

## References

- Roadmap: `context/foundation/roadmap.md` (S-05)
- PRD: FR-003 and Access Control in `context/foundation/prd.md`
- Similar implementation: `src/main/java/com/example/gymtrack/plan/TrainingPlanService.java`, `TrainingPlanController.java`, `frontend/src/pages/PlansPage.tsx`, `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Custom exercise data and API

#### Automated

- [x] 1.1 Backend tests pass: `./mvnw test` — 8d9a902
- [x] 1.2 New test class passes on its own: `./mvnw test -Dtest=CustomExerciseControllerTest` — 8d9a902

#### Manual

- [x] 1.3 POST creates a custom exercise that then shows up in the list with custom: true — 8d9a902
- [x] 1.4 A second account does not see it; DELETE removes it; a duplicate or catalog-equal name is refused with 409 — 8d9a902

### Phase 2: Enforce visibility everywhere

#### Automated

- [x] 2.1 Backend tests pass: `./mvnw test` — 59984dc
- [x] 2.2 New test class passes on its own: `./mvnw test -Dtest=CustomExerciseVisibilityTest` — 59984dc

#### Manual

- [x] 2.3 Account B gets 404 when logging a set or saving a plan with account A's custom exercise id — 59984dc
- [x] 2.4 Account A still sees its custom exercise in substitutes of a same-group catalog exercise — 59984dc

### Phase 3: "My exercises" page

#### Automated

- [x] 3.1 Frontend builds: `cd frontend && npm run build` — 738c442
- [x] 3.2 Lint passes: `cd frontend && npm run lint` — 738c442

#### Manual

- [x] 3.3 Adding a custom exercise shows it in the list, the workout picker and the plan editor picker — 738c442
- [x] 3.4 Duplicate and catalog names show the error inline; unused exercises delete, used ones are refused and kept — 738c442
- [x] 3.5 A second account does not see the exercise anywhere — 738c442
- [x] 3.6 Layout is usable at phone width — 738c442
