# User-Defined Training Plan Implementation Plan

## Overview

Build roadmap slice S-02 (PRD FR-009): a logged-in user creates several named training plans, each a plain ordered list of 1–50 catalog exercises (duplicates allowed). They can edit a plan (rename, add, remove, reorder with up/down buttons) and delete it after an explicit confirmation. Plans are private to their owner. The plan format stays a simple ordered list with no imposed template, so it remains forward-compatible with the future recommender (FR-013).

## Current State Analysis

- Backend has `user`, `exercise`, `auth`, `config` and `workout` packages; there is no plan entity, repository or controller. Flyway has V1–V4, next is V5 (`src/main/resources/db/migration/`).
- Identity: `@AuthenticationPrincipal CurrentUser(UUID id, String email)`; `/api/**` is authenticated by default. Owner scoping is done in queries (`findByIdAndUserId` in `WorkoutSessionRepository`), and foreign ids return 404.
- Catalog: `GET /api/exercises` returns `ExerciseResponse` (UUID id, name, muscle groups); `exercises.id` is `uuid`.
- Error handling: `{"error": "<message>"}` bodies. `WorkoutExceptionHandler` is a global `@RestControllerAdvice` and already maps `MethodArgumentTypeMismatchException` (malformed UUID) to a 400 for every controller; bean-validation failures are mapped to 400 by the global `AuthExceptionHandler`.
- Conventions: UUID ids via `GenerationType.UUID`, protected no-arg constructor, getters only, `@CreationTimestamp`-style timestamps as `Instant`; Flyway owns the schema and Hibernate only validates it; `open-in-view=false`, so responses are built inside the service transaction.
- Frontend: routes are `/login`, `/register` and gated `/` (`App.tsx`); `Topbar` (rendered by `RequireAuth`) shows only the user email and Log out, with no navigation. `client.ts` has `authFetch`-based typed functions including `getExercises()`; `ExercisePicker` is a `<select>` taking `exercises`, `selectedId`, `onChange`. A delete-with-inline-confirm pattern exists in `SessionSetList`.
- Production runs Flyway off with `ddl-auto=update` (`fly.toml`); S-01's V4 constraints already do not exist there.

## Desired End State

A user can: open Plans from the Topbar → create a named plan → add catalog exercises (including the same one twice) → reorder with up/down buttons and remove entries → save → see the plan in the list → reopen and edit it → delete it after confirming. Server validation errors show inline without losing the form. Another user can never list, read, change or delete these plans. Verified by backend integration tests plus the manual flows in Phases 2–4. After the amendment, each plan entry also carries expected sets and reps, and from the workout page the user can start a workout from a saved plan and step through its exercises with the targets visible (Phases 5–6).

### Key Discoveries:

- Ownership must be enforced in queries (look up by id **and** user id); foreign ids return 404, matching `WorkoutService.findOwned` (S-01).
- The malformed-UUID 400 and bean-validation 400 `{"error"}` shapes already exist globally — the plan package needs only not-found handling of its own.
- Unknown exercise id in a request → 404 `Exercise not found`, matching S-01's `logSet` behaviour.
- Entity and test templates: `WorkoutSession.java` / `WorkoutSet.java` for mapping, `WorkoutSetControllerTest` (two users via `UserRepository`, tokens via `JwtService`, Testcontainers postgres:16-alpine) for tests, `WorkoutSchemaTest` for DB-rule tests.
- Frontend delete confirm is an inline Confirm/Cancel step on the row (`SessionSetList`), not `window.confirm`.

## What We're NOT Doing

- Per-entry weight targets; skip/return and rest timer in a plan-driven session (S-06). *(Amended after Phase 4: required per-entry sets/reps targets and starting a workout from a plan with step-through are now in scope as Phases 5–6.)*
- Plan templates or recommendations (S-07 / FR-013); sharing or importing plans (PRD Non-Goals).
- Plan duplicate/clone, archiving, reordering the plan list, drag-and-drop, plan-name uniqueness, unsaved-changes guard on the editor.
- Granular per-entry endpoints (add/move/remove calls); edits are a whole-plan replace.
- Enabling Flyway or deploying to production; V5 constraints will not exist there while `ddl-auto=update` is in force.
- Frontend test runner setup (none exists in `package.json`).

## Implementation Approach

Backend first, bottom-up (schema → API), each phase verified by integration tests, then frontend (list and navigation, then editor). New package `com.example.gymtrack.plan` holds the plan code; base route `/api/training-plans`. A plan is a `training_plans` row with ordered `training_plan_entries` (own id, `exercise_id`, `position`). Create and edit both send the full ordered list of exercise ids (`POST` / `PUT`); the server rewrites the entries atomically in one transaction, so reorder and remove need no extra endpoints. Entries therefore get new ids on every save — nothing else may reference an entry id (S-06 should reference the plan and read entries by position).

**Amendment (after Phase 4, user request):** Phase 5 adds required per-entry expected sets and reps (breaking change to the plan request/response shape: `exerciseIds[]` becomes `entries[{exerciseId, sets, reps}]`). Phase 6 lets a workout session optionally reference a plan and walks the user through its exercises on the workout page. Sessions reference the plan id only and read entries by position, never by entry id.

Decisions (from planning interview): many named plans per user; duplicates allowed; reorder with up/down buttons; whole-plan replace API; navigation via Topbar links and `/plans` routes; name 1–60 characters (duplicate names allowed), 1–50 exercises per plan.

## Critical Implementation Details

- **State sequencing / uniqueness:** `(plan_id, position)` is unique. On `PUT`, Hibernate flushes inserts before deletes, so replacing entries with `orphanRemoval` and re-adding at the same positions can violate the constraint. Clear the old entries and flush before adding the new ones (or delete them with an explicit bulk delete), inside the same transaction.

## Phase 1: Data model

### Overview

Schema and JPA mapping for plans and their ordered entries.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V5__create_training_plans.sql`

**Intent**: Create the two tables with integrity rules enforced in the database.

**Contract**:
- `training_plans(id uuid pk, user_id uuid not null → users(id), name varchar(60) not null, created_at timestamptz not null, updated_at timestamptz not null)`; index on `(user_id, updated_at)`.
- `training_plan_entries(id uuid pk, plan_id uuid not null → training_plans(id) on delete cascade, exercise_id uuid not null → exercises(id), position int not null check (position >= 0))`; unique constraint on `(plan_id, position)`; index on `(exercise_id)`.
- Timestamp columns use `timestamp(6) with time zone`, as in V1/V4.

#### 2. Entities and repositories

**Files**: `src/main/java/com/example/gymtrack/plan/TrainingPlan.java`, `TrainingPlanEntry.java`, `TrainingPlanRepository.java`

**Intent**: Map the tables following the `WorkoutSession`/`WorkoutSet` conventions; ids generated with `GenerationType.UUID`, timestamps as `Instant`.

**Contract**:
- `TrainingPlan(UUID userId, String name)` sets `createdAt`/`updatedAt = now`; `rename(String)`, `replaceEntries(List<UUID> exerciseIds)` (assigns positions 0..n-1 in list order, touches `updatedAt`), `getEntries()` ordered by position (`@OneToMany(mappedBy = "plan", cascade = ALL, orphanRemoval = true) @OrderBy("position")`).
- `TrainingPlanEntry(TrainingPlan plan, UUID exerciseId, int position)`.
- `TrainingPlanRepository`: `findByUserIdOrderByUpdatedAtDesc`, `findByIdAndUserId`.

#### 3. Schema test

**File**: `src/test/java/com/example/gymtrack/plan/TrainingPlanSchemaTest.java`

**Intent**: Prove the migration applies and the DB rules hold.

**Contract**: Testcontainers test asserting: two entries with the same `(plan_id, position)` violate the unique constraint; a negative position is rejected by the CHECK; deleting a plan cascades its entries; an entry with an unknown `exercise_id` is rejected by the foreign key.

### Success Criteria:

#### Automated Verification:

- Schema test passes (migration applies, Hibernate `validate` succeeds): `./mvnw test -Dtest=TrainingPlanSchemaTest`
- Full backend suite still passes: `./mvnw test`

#### Manual Verification:

- App starts against local Postgres with the new migration and the tables exist: `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Plan API

### Overview

Owner-scoped endpoints to list, read, create, replace and delete plans.

### Changes Required:

#### 1. Service

**File**: `src/main/java/com/example/gymtrack/plan/TrainingPlanService.java`

**Intent**: All ownership and replace rules in one transactional place; the controller stays thin.

**Contract**:
- `list(userId)` → plan summaries, most recently updated first.
- `get(userId, planId)` → full plan with ordered entries and exercise names; unknown/foreign id → not-found.
- `create(userId, name, exerciseIds)` → new plan; unknown exercise id → not-found (`Exercise not found`).
- `replace(userId, planId, name, exerciseIds)` → renames and rewrites all entries atomically (see Critical Implementation Details); foreign/unknown plan → not-found; unknown exercise → not-found.
- `delete(userId, planId)` → deletes the plan and its entries; foreign/unknown → not-found.
- Responses are built inside the transaction (`open-in-view=false`).

#### 2. Controller, DTOs, errors

**Files**: `TrainingPlanController.java`, `PlanRequest.java`, `PlanResponse.java`, `PlanSummaryResponse.java`, `PlanEntryResponse.java`, `PlanNotFoundException.java`, `PlanExceptionHandler.java` (all under `plan/`)

**Intent**: Expose the REST contract below with the existing `{"error": ...}` shape; bean validation on the request. Do not add handlers for validation or malformed-UUID errors — they already exist globally.

**Contract**:
- `GET /api/training-plans` → 200 `[PlanSummaryResponse(id, name, exerciseCount, updatedAt)]`.
- `GET /api/training-plans/{id}` → 200 `PlanResponse(id, name, createdAt, updatedAt, exercises[PlanEntryResponse(exerciseId, exerciseName, position)])`.
- `POST /api/training-plans` body `PlanRequest(name, exerciseIds[])` → 201 `PlanResponse`.
- `PUT /api/training-plans/{id}` body `PlanRequest` → 200 `PlanResponse`.
- `DELETE /api/training-plans/{id}` → 204.
- `PlanRequest`: `name` not blank after trim, at most 60 characters (stored trimmed); `exerciseIds` not null, 1–50 elements, no null elements; duplicates allowed.
- Status mapping: validation 400, not found/foreign plan or unknown exercise 404, unauthenticated 401 (existing).

#### 3. Tests

**File**: `src/test/java/com/example/gymtrack/plan/TrainingPlanControllerTest.java`

**Intent**: Cover CRUD, validation and isolation using the `WorkoutSetControllerTest` pattern (two users via `UserRepository`, tokens via `JwtService`, a real catalog exercise from `ExerciseRepository`).

**Contract**: cases — 401 without token on every route; create returns 201 with entries in request order and positions 0..n-1; duplicate exercises are preserved; `PUT` reorders and removes entries and leaves no stale entries; list returns only the caller's plans, most recently updated first; user B gets 404 on user A's plan for get/put/delete; delete happy path then 404 on re-read; 400 for blank name, name longer than 60, empty list, more than 50 exercises, null element; unknown exercise id → 404 on create and replace; name is stored trimmed.

### Success Criteria:

#### Automated Verification:

- Plan API tests pass: `./mvnw test -Dtest=TrainingPlanControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the app running locally, a curl/HTTP-client flow (register → create plan with a repeated exercise → reorder via PUT → list → delete) returns the documented statuses and bodies.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Frontend plan list and navigation

### Overview

Typed API client, navigation, and the plan list with delete.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed functions for the plan endpoints built on `authFetch`, setting `Content-Type: application/json` for bodies and handling the 204 from delete.

**Contract**: `listPlans()`, `getPlan(id)`, `createPlan({name, exerciseIds})`, `updatePlan(id, {name, exerciseIds})`, `deletePlan(id)`; exported types mirror the Phase 2 DTOs.

#### 2. Navigation and list page

**Files**: `frontend/src/components/Topbar.tsx`, `frontend/src/pages/PlansPage.tsx`, `frontend/src/styles/plans.css` (Topbar styles in `frontend/src/styles/topbar.css`), `frontend/src/App.tsx`

**Intent**: Add Workout and Plans links to the Topbar (current link visibly marked) and a gated `/plans` route showing the user's plans: name, exercise count, an Edit link, a Delete action behind an inline Confirm/Cancel step, and a "New plan" link. Show an explicit empty state with no plans, a loading state, and API errors inline from the `{"error"}` body. Touch-friendly sizes.

**Contract**: `/plans` is wrapped in `RequireAuth`; links to `/plans/new` and `/plans/:id` target the Phase 4 routes (the route entries themselves are added in Phase 4, so before then they are simply not navigable); after a confirmed delete the row is removed from the list.

### Success Criteria:

#### Automated Verification:

- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Topbar shows Workout and Plans links on gated pages; both navigate and the current page is marked.
- With no plans, `/plans` shows an empty state; plans created via the API show name and exercise count.
- Deleting a plan asks for confirmation and removes it only after confirming; cancelling keeps it.
- Usable at phone width (about 375 px) with comfortably tappable controls.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Frontend plan editor

### Overview

Create and edit a plan: name, exercises, order.

### Changes Required:

#### 1. Editor page and components

**Files**: `frontend/src/pages/PlanEditorPage.tsx`, `frontend/src/components/PlanExerciseList.tsx`, `frontend/src/styles/plans.css`, `frontend/src/App.tsx`

**Intent**: Routes `/plans/new` and `/plans/:id` (both gated) render one editor. It has a name input, an exercise picker (reusing `ExercisePicker`) with an "Add exercise" button, and the ordered list of chosen exercises, each row with Move up, Move down (disabled at the ends) and Remove. Save creates (`POST`) or replaces (`PUT`) the plan and returns to `/plans`; server errors (validation, not found) show inline without clearing the form. When editing, load the plan first and handle a not-found/forbidden id with an inline error and a link back.

**Contract**: editor state = `{name, entries[], selectedExercise, loading, saving, error}` where `entries` are local `{key, exerciseId, exerciseName}` rows so duplicates and reordering work without server ids; Save is disabled while saving or when the name is blank or the list is empty (server still validates); tap targets suitable for phone width.

### Success Criteria:

#### Automated Verification:

- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Create a plan with a name and several exercises including one added twice; after saving it appears in the list with the right count.
- Reopen it: exercises are in the saved order; Move up/down and Remove change the order and survive a save and reload.
- Invalid input (blank name, name over 60 characters, over 50 exercises) shows the server error without losing the form.
- A second account cannot open the first account's plan by URL (inline not-found error) and sees none of its plans in the list.
- Usable at phone width (about 375 px) with comfortably tappable controls; save feedback is visible within about a second.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Phase 5: Per-exercise sets/reps targets

### Overview

Every plan entry gets required expected `sets` and `reps`. Existing plans are backfilled; the API shape moves from `exerciseIds[]` to `entries[]`; the editor edits the targets.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V6__add_plan_entry_targets.sql`

**Intent**: Add the two target columns, backfill existing rows, then make them mandatory with range checks.

**Contract**:
- `training_plan_entries.sets integer`, `reps integer`: add nullable, `update` existing rows to `sets = 3, reps = 10`, then `set not null`; add CHECKs `sets between 1 and 20` and `reps between 1 and 100` (reps range matches `workout_sets`).

#### 2. Entity and service

**Files**: `plan/TrainingPlanEntry.java`, `plan/TrainingPlan.java`, `plan/TrainingPlanService.java`

**Intent**: Carry sets/reps through the model; keep the replace/flush rules from Critical Implementation Details unchanged.

**Contract**:
- `TrainingPlanEntry(plan, exerciseId, position, sets, reps)` with getters.
- `replaceEntries` takes an ordered list of entry inputs (`exerciseId`, `sets`, `reps`) instead of bare ids; `create`/`replace` in the service take the same.
- Exercise-existence check and name lookup operate on the entries' exercise ids as before.

#### 3. API shape

**Files**: `plan/PlanRequest.java`, `plan/PlanEntryResponse.java`, new `plan/PlanEntryRequest.java`

**Intent**: Replace `exerciseIds[]` with `entries[]`; responses echo the targets. No compatibility shim — the only client is this SPA and is updated in step 5.

**Contract**:
- `PlanRequest(name, entries[PlanEntryRequest(exerciseId, sets, reps)])`: `entries` not null, 1–50 elements, no null elements; `exerciseId` not null; `sets` required 1–20; `reps` required 1–100; other rules unchanged.
- `PlanEntryResponse(exerciseId, exerciseName, position, sets, reps)`. List/summary responses unchanged.

#### 4. Backend tests

**Files**: `TrainingPlanSchemaTest.java`, `TrainingPlanControllerTest.java`

**Intent**: Keep existing coverage working on the new shape and prove the new rules.

**Contract**: update fixtures/inserts for the new columns and request shape; add cases — sets/reps are persisted and returned per entry and reorder keeps each entry's own targets; 400 for missing, 0, negative or over-range sets/reps; the DB rejects out-of-range sets/reps via the CHECKs; the migration backfills (a row inserted before V6 semantics is not required — assert via the NOT NULL + range constraints).

#### 5. Frontend

**Files**: `frontend/src/api/client.ts`, `frontend/src/pages/PlanEditorPage.tsx`, `frontend/src/components/PlanExerciseList.tsx`, `frontend/src/styles/plans.css`

**Intent**: Types and calls use `entries`; each editor row has Sets and Reps number inputs (defaults 3 and 10 when an exercise is added) that stay with the row through Move up/down.

**Contract**: local entry rows become `{key, exerciseId, exerciseName, sets, reps}`; inputs are touch-friendly numeric fields; no client-side range blocking (server errors show inline as before), but empty/NaN values are not sent silently — send what the user typed so the server rejects it.

### Success Criteria:

#### Automated Verification:

- Schema and API tests pass: `./mvnw test -Dtest='TrainingPlan*Test'`
- Full backend suite passes: `./mvnw test`
- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Create a plan with different sets/reps per exercise (including a repeated exercise with different targets); reopen it: targets are saved per row and survive Move up/down, Remove and a reload.
- Existing plans created before this phase open with 3 × 10 targets.
- Out-of-range sets/reps (0, 21 sets, 101 reps) show the server error without losing the form.
- Sets/reps inputs are comfortably usable at phone width (about 375 px).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Start a workout from a plan

### Overview

A workout session can optionally reference a plan; the workout page offers "Start from plan" and then walks the user through the plan's exercises with targets and progress, while logging sets exactly as in S-01.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V7__add_workout_session_plan.sql`

**Intent**: Optional link from a session to the plan it was started from.

**Contract**: `workout_sessions.plan_id uuid null references training_plans (id) on delete set null`; index on `(plan_id)`. Production caveat: as with V5/V6, `ddl-auto=update` creates the column but not the FK behaviour tuning there.

#### 2. Backend session start

**Files**: `workout/WorkoutSession.java`, `workout/WorkoutService.java`, `workout/WorkoutController.java`, `workout/SessionResponse.java`, new `workout/StartSessionRequest.java`

**Intent**: `POST /api/workout-sessions` accepts an optional body `{planId}`; behaviour for an empty body is unchanged.

**Contract**:
- `WorkoutSession` gains nullable `planId` (constructor overload taking it); `SessionResponse` gains `planId` (nullable).
- `startOrGetActive(userId, planId)`: if an active session exists it is returned unchanged (200) and `planId` is ignored; otherwise the plan must be owned by the caller (`TrainingPlanRepository.findByIdAndUserId`), else 404 `Training plan not found`, and the new session stores `planId`. The race/unique-violation handling stays as is.
- Request body is optional (`@RequestBody(required = false)`); malformed UUID → existing global 400.
- The workout package may depend on `TrainingPlanRepository` (read-only existence/ownership check); do not copy plan data into the session.

#### 3. Backend tests

**Files**: `workout/WorkoutSessionControllerTest.java` (and `WorkoutSchemaTest.java` for the FK)

**Contract**: start without body still works and has `planId` null; start with an owned plan stores and returns `planId`; foreign or unknown plan → 404 and no session created; start while a session is active returns the existing one and keeps its original `planId`; deleting a plan nulls `plan_id` on sessions that referenced it (schema test).

#### 4. Frontend walk-through

**Files**: `frontend/src/api/client.ts`, `frontend/src/pages/WorkoutPage.tsx`, new `frontend/src/components/PlanWalkthrough.tsx`, `frontend/src/styles/workout.css`

**Intent**: Starting: next to "Start workout", a plan select ("Start from plan…") lists the user's plans; choosing one starts the session with that `planId`. Active session with `planId`: load the plan (`getPlan`); if it 404s (deleted), fall back to the normal free-form view. `PlanWalkthrough` lists the plan's entries in order, each showing exercise name, target `sets × reps`, and progress `logged/sets`; the current exercise is the first entry whose logged sets are below its target, and is selected in the existing picker/logger automatically; tapping any entry selects it instead. Free-form logging, chart, set list and End workout keep working as today.

**Contract**:
- `startSession(planId?)`; `WorkoutSession` type gains `planId: string | null`.
- Progress is derived on the client from the session's logged sets: walk plan entries in order and let each consume up to its `sets` logged sets of the same exercise, so a repeated exercise fills its first entry before the second. Done entries are visibly marked; reps targets are shown as a hint, not enforced.
- No skip/return controls and no rest timer (S-06); no server-side plan progress.

### Success Criteria:

#### Automated Verification:

- Workout and schema tests pass: `./mvnw test -Dtest='Workout*Test'`
- Full backend suite passes: `./mvnw test`
- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- From an idle workout page, choose a plan and start: the plan's exercises appear in order with `sets × reps` targets and `0/sets` progress; the first exercise is preselected.
- Logging sets advances progress; after the target is reached the next exercise becomes current; a repeated exercise fills its entries in order.
- Tapping another entry selects it; free-form logging of an exercise not in the plan still works.
- Reload mid-workout: the walk-through and progress are restored; ending the workout returns to the idle page.
- Deleting the plan while a session from it is active falls back to the normal workout view without errors.
- A second account cannot start a session from the first account's plan.
- Usable at phone width (about 375 px).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Backend logic is covered through integration tests (the repo has no unit-only layer for domain code); the replace/ordering rule, validation and ownership rules are exercised via MockMvc cases above.

### Integration Tests:

- `TrainingPlanSchemaTest`, `TrainingPlanControllerTest` on Testcontainers Postgres, including cross-user isolation, duplicates and reorder-by-replace.

### Manual Testing Steps:

1. Register, open Plans, create "Push" with Barbell Bench Press twice plus two other exercises; save.
2. Reopen, move an exercise to the top, remove one, save; reload and confirm the order persisted.
3. Delete a plan: cancel keeps it, confirm removes it.
4. Log in as a second user: no plans visible, and the first user's plan URL shows not found.

## Performance Considerations

Small data volume (PRD `target_scale`); at most 50 entries per plan and a handful of plans per user. List returns summaries only. Indexes on `(user_id, updated_at)` and `(exercise_id)` cover the queries. Acknowledgement target is about one second (PRD NFR).

## Migration Notes

V5, V6 and V7 apply only where Flyway runs (local, tests). Production keeps `ddl-auto=update` and Flyway off (`fly.toml`), so deploying this slice there would create the tables from entities without the unique and CHECK constraints; enabling Flyway in production is a separate decision (noted in the F-02 and S-01 plans) and not part of this change.

## References

- Roadmap: `context/foundation/roadmap.md` (S-02); PRD: `context/foundation/prd.md` (FR-009, NFR on destructive actions)
- Entity/service/test patterns: `src/main/java/com/example/gymtrack/workout/WorkoutSession.java`, `WorkoutService.java`, `src/test/java/com/example/gymtrack/workout/WorkoutSetControllerTest.java`, `WorkoutSchemaTest.java`
- Frontend patterns: `frontend/src/pages/WorkoutPage.tsx`, `frontend/src/components/SessionSetList.tsx` (inline delete confirm), `ExercisePicker.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model

#### Automated

- [x] 1.1 Schema test passes (migration applies, Hibernate `validate` succeeds): `./mvnw test -Dtest=TrainingPlanSchemaTest` — 6e171d8
- [x] 1.2 Full backend suite still passes: `./mvnw test` — 6e171d8

#### Manual

- [x] 1.3 App starts against local Postgres with the new migration and the tables exist: `./mvnw spring-boot:run -Dspring-boot.run.profiles=local` — 6e171d8

### Phase 2: Plan API

#### Automated

- [x] 2.1 Plan API tests pass: `./mvnw test -Dtest=TrainingPlanControllerTest` — f03fe36
- [x] 2.2 Full backend suite passes: `./mvnw test` — f03fe36

#### Manual

- [x] 2.3 With the app running locally, a curl/HTTP-client flow (register → create plan with a repeated exercise → reorder via PUT → list → delete) returns the documented statuses and bodies — f03fe36

### Phase 3: Frontend plan list and navigation

#### Automated

- [x] 3.1 Lint passes: `cd frontend && npm run lint` — aed4701
- [x] 3.2 Type check and build pass: `cd frontend && npm run build` — aed4701

#### Manual

- [x] 3.3 Topbar shows Workout and Plans links on gated pages; both navigate and the current page is marked — aed4701
- [x] 3.4 With no plans, `/plans` shows an empty state; plans created via the API show name and exercise count — aed4701
- [x] 3.5 Deleting a plan asks for confirmation and removes it only after confirming; cancelling keeps it — aed4701
- [x] 3.6 Usable at phone width (about 375 px) with comfortably tappable controls — aed4701

### Phase 4: Frontend plan editor

#### Automated

- [x] 4.1 Lint passes: `cd frontend && npm run lint` — 534d8f2
- [x] 4.2 Type check and build pass: `cd frontend && npm run build` — 534d8f2

#### Manual

- [x] 4.3 Create a plan with a name and several exercises including one added twice; after saving it appears in the list with the right count — 534d8f2
- [x] 4.4 Reopen it: exercises are in the saved order; Move up/down and Remove change the order and survive a save and reload — 534d8f2
- [x] 4.5 Invalid input (blank name, name over 60 characters, over 50 exercises) shows the server error without losing the form — 534d8f2
- [x] 4.6 A second account cannot open the first account's plan by URL (inline not-found error) and sees none of its plans in the list — 534d8f2
- [x] 4.7 Usable at phone width (about 375 px) with comfortably tappable controls; save feedback is visible within about a second — 534d8f2

### Phase 5: Per-exercise sets/reps targets

#### Automated

- [x] 5.1 Schema and API tests pass: `./mvnw test -Dtest='TrainingPlan*Test'`
- [x] 5.2 Full backend suite passes: `./mvnw test`
- [x] 5.3 Lint passes: `cd frontend && npm run lint`
- [x] 5.4 Type check and build pass: `cd frontend && npm run build`

#### Manual

- [x] 5.5 Create a plan with different sets/reps per exercise (including a repeated exercise with different targets); reopen it: targets are saved per row and survive Move up/down, Remove and a reload
- [x] 5.6 Existing plans created before this phase open with 3 × 10 targets
- [x] 5.7 Out-of-range sets/reps (0, 21 sets, 101 reps) show the server error without losing the form
- [x] 5.8 Sets/reps inputs are comfortably usable at phone width (about 375 px)

### Phase 6: Start a workout from a plan

#### Automated

- [ ] 6.1 Workout and schema tests pass: `./mvnw test -Dtest='Workout*Test'`
- [ ] 6.2 Full backend suite passes: `./mvnw test`
- [ ] 6.3 Lint passes: `cd frontend && npm run lint`
- [ ] 6.4 Type check and build pass: `cd frontend && npm run build`

#### Manual

- [ ] 6.5 From an idle workout page, choose a plan and start: exercises appear in order with `sets × reps` targets and `0/sets` progress; the first exercise is preselected
- [ ] 6.6 Logging sets advances progress; after the target is reached the next exercise becomes current; a repeated exercise fills its entries in order
- [ ] 6.7 Tapping another entry selects it; free-form logging of an exercise not in the plan still works
- [ ] 6.8 Reload mid-workout: the walk-through and progress are restored; ending the workout returns to the idle page
- [ ] 6.9 Deleting the plan while a session from it is active falls back to the normal workout view without errors
- [ ] 6.10 A second account cannot start a session from the first account's plan
- [ ] 6.11 Usable at phone width (about 375 px)
