# Core Workout Logging Loop Implementation Plan

## Overview

Build roadmap slice S-01: a logged-in user starts a workout session, picks a seeded exercise, logs sets (reps + weight in kg), optionally deletes a mistaken set, ends the session, and sees the exercise's progression chart (top weight per session) update without a page reload. Sets are the source of truth; the chart is a read-side query on top (PRD FR-010 resolution, `roadmap.md:115`).

## Current State Analysis

- Backend has only `user`, `exercise`, `auth`, `config` packages; no session/set entity, repository or controller. Flyway has V1–V3, next is V4 (`research.md`, Summary).
- Identity: `@AuthenticationPrincipal CurrentUser(UUID id, String email)` (`UserController.java:11-14`, `CurrentUser.java:5`). `/api/**` is authenticated by default (`SecurityConfig.java:44-49`) but nothing filters data by user yet.
- Catalog: `GET /api/exercises` returns `ExerciseResponse` with UUID `id` (`ExerciseController.java:17-24`); `exercises.id` is `uuid` (`V2__create_exercises_and_seed.sql:1-6`).
- Frontend: placeholder `DashboardPage` (`DashboardPage.tsx:9`), one gated route (`App.tsx:15-22`), `authFetch` helper that throws on non-2xx and does not set `Content-Type` (`client.ts:79-90`), no chart dependency (`frontend/package.json`).
- Production runs Flyway off and `ddl-auto=update` (`fly.toml:16-17`).

## Desired End State

A user can: log in → start a workout → choose an exercise → log a set (reps + kg) → see the chart point appear immediately → log more sets (possibly other exercises) → end the workout. Reloading the page mid-workout resumes the active session. The first-ever set renders a one-point chart. Another user can never see or touch these records. Verified by the backend integration tests plus the manual flow in Phases 4–5.

### Key Discoveries:

- Ownership must be enforced in queries (look up by id **and** user id); cross-user access returns 404, not 403, to avoid leaking existence (inference from `research.md`, Architecture Insights).
- Entity conventions: UUID id, protected no-arg constructor, getters only, `@CreationTimestamp` (`User.java:13-54`); Flyway owns schema, Hibernate `validate` (`application.properties:7`), `open-in-view=false` (`application.properties:8`), so responses must be built inside the service/transaction.
- Error body shape is `{"error": "<message>"}` (`AuthExceptionHandler.java:13-31`), read by the frontend (`client.ts:16-26`).
- Integration test template: `@SpringBootTest` + MockMvc + Testcontainers postgres:16 (`ExerciseControllerTest.java:30-54`).

## What We're NOT Doing

- Set edit (PATCH), plans, progression recommendation (S-03), PR flag (S-08), guided navigation/rest timer (S-06), substitution (S-04), volume chart or weight/volume toggle.
- Session deletion, session history list, auto-closing stale sessions, lb units.
- Global 401 handling/redirect on expired tokens in the frontend (existing gap, `client.ts`).
- Enabling Flyway or deploying to production; the V4 constraints (partial unique index, CHECKs) will not exist there while `ddl-auto=update` is in force.
- Frontend test runner setup (none exists in `package.json`).

## Implementation Approach

Backend first, bottom-up (schema → write API → read API), each phase verified by MockMvc integration tests, then frontend (workout flow, then chart). Package `com.example.gymtrack.workout` holds session/set code; the progression read endpoint lives there too. One active session per user is enforced twice: service logic (start returns the existing active session) and a partial unique index (race-safe). Chart point = one per session containing that exercise, y = max `weight_kg`, x = session `started_at`; active sessions are included so the first set shows immediately.

Decisions (from planning interview): one active session; top weight per session; kg decimal with 0.5 kg step; delete-with-confirm, no edit; Recharts with refetch after each change.

## Critical Implementation Details

- **State sequencing / race:** two concurrent `POST /api/workout-sessions` could both pass the "no active session" check. The partial unique index is the arbiter: on unique-violation, re-read and return the existing active session instead of failing.

## Phase 1: Data model

### Overview

Schema and JPA mapping for sessions and sets.

### Changes Required:

#### 1. Migration

**File**: `src/main/resources/db/migration/V4__create_workout_sessions_and_sets.sql`

**Intent**: Create the two tables with integrity rules enforced in the database.

**Contract**:
- `workout_sessions(id uuid pk, user_id uuid not null → users(id), started_at timestamptz not null, ended_at timestamptz null)`; partial unique index on `(user_id) where ended_at is null`; index on `(user_id, started_at)`.
- `workout_sets(id uuid pk, session_id uuid not null → workout_sessions(id) on delete cascade, exercise_id uuid not null → exercises(id), reps int not null check (reps between 1 and 100), weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg <= 1000), logged_at timestamptz not null)`; indexes on `(session_id)` and `(exercise_id)`.

#### 2. Entities and repositories

**Files**: `src/main/java/com/example/gymtrack/workout/WorkoutSession.java`, `WorkoutSet.java`, `WorkoutSessionRepository.java`, `WorkoutSetRepository.java`

**Intent**: Map the tables following the `User`/`Exercise` conventions; ids generated with `GenerationType.UUID`, timestamps as `Instant`.

**Contract**:
- `WorkoutSession(UUID userId)` sets `startedAt = now`; `end()` sets `endedAt`; `isActive()`.
- `WorkoutSet(WorkoutSession session, UUID exerciseId, int reps, BigDecimal weightKg)`.
- `WorkoutSessionRepository`: `findByUserIdAndEndedAtIsNull`, `findByIdAndUserId`.
- `WorkoutSetRepository`: `findBySessionIdOrderByLoggedAtAsc`, `findByIdAndSessionId`, plus the progression aggregate query added in Phase 3.

#### 3. Schema test

**File**: `src/test/java/com/example/gymtrack/workout/WorkoutSchemaTest.java`

**Intent**: Prove the migration applies and the DB rules hold.

**Contract**: Testcontainers test asserting: second active session for same user violates the unique index; ended session allows a new active one; reps 0 and weight 0 are rejected by CHECKs; deleting a session cascades its sets.

### Success Criteria:

#### Automated Verification:

- Schema test passes (migration applies, Hibernate `validate` succeeds): `./mvnw test -Dtest=WorkoutSchemaTest`
- Full backend suite still passes: `./mvnw test`

#### Manual Verification:

- App starts against local Postgres with the new migration: `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Session and set API

### Overview

Owner-scoped endpoints to start/read/end a session and log/delete sets.

### Changes Required:

#### 1. Service

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutService.java`

**Intent**: All lifecycle and ownership rules in one transactional place; controllers stay thin.

**Contract**:
- `startOrGetActive(userId)` → existing active session or a new one (handles unique-violation race per Critical Implementation Details); reports whether it was created.
- `getActive(userId)` → optional session with its sets.
- `end(userId, sessionId)` → sets `endedAt`; unknown/foreign id → not-found; already ended → conflict.
- `logSet(userId, sessionId, exerciseId, reps, weightKg)` → not-found for foreign/unknown session or unknown exercise; conflict if session ended; weight must be a multiple of 0.5.
- `deleteSet(userId, sessionId, setId)` → not-found if session not owned or set not in session; conflict if session ended.

#### 2. Controller, DTOs, errors

**Files**: `WorkoutController.java`, `SessionResponse.java`, `SetResponse.java`, `LogSetRequest.java`, `WorkoutExceptionHandler.java`, `WorkoutNotFoundException.java`, `WorkoutConflictException.java` (all under `workout/`)

**Intent**: Expose the REST contract below with the existing `{"error": ...}` error shape; bean validation on the request.

**Contract**:
- `POST /api/workout-sessions` → 201 new / 200 existing active; body `SessionResponse(id, startedAt, endedAt, sets[])`.
- `GET /api/workout-sessions/current` → 200 `SessionResponse` or 204 when none.
- `POST /api/workout-sessions/{id}/end` → 200 `SessionResponse`.
- `POST /api/workout-sessions/{id}/sets` body `{exerciseId, reps, weightKg}` → 201 `SetResponse(id, exerciseId, reps, weightKg, loggedAt)`.
- `DELETE /api/workout-sessions/{id}/sets/{setId}` → 204.
- Status mapping: validation 400, not found/foreign 404, ended-session 409. Unauthenticated → 401 (existing).
- `LogSetRequest`: `exerciseId` not null, `reps` 1–100, `weightKg` > 0 and ≤ 1000; 0.5 step enforced in the service.

#### 3. Tests

**Files**: `src/test/java/com/example/gymtrack/workout/WorkoutSessionControllerTest.java`, `WorkoutSetControllerTest.java`

**Intent**: Cover lifecycle, validation and isolation using the `ExerciseControllerTest` pattern (two users via `UserRepository`, tokens via `JwtService`).

**Contract**: cases — 401 without token on each route; start twice returns same session (201 then 200); current returns 204 when none; end then log → 409; end twice → 409; log with bad reps/weight/step → 400; unknown exercise → 404; user B gets 404 on user A's session for end/log/delete; delete set happy path and ended-session 409.

### Success Criteria:

#### Automated Verification:

- Session lifecycle tests pass: `./mvnw test -Dtest=WorkoutSessionControllerTest`
- Set tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the app running locally, a curl/HTTP-client flow (register → start → log set → end) returns the documented statuses and bodies.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Progression endpoint

### Overview

Read-side chart data derived from logged sets.

### Changes Required:

#### 1. Query and endpoint

**Files**: `WorkoutSetRepository.java` (aggregate query), `ProgressionController.java`, `ProgressionPointResponse.java` (under `workout/`)

**Intent**: Return one point per session that contains the exercise, scoped to the caller, oldest first.

**Contract**: `GET /api/exercises/{exerciseId}/progression` → 200 `[{sessionId, date (session startedAt), topWeightKg}]` ordered by `startedAt` ascending; only the caller's sessions; includes active sessions; empty array when no sets; unknown exercise id → 404. Aggregation: `max(weight_kg)` grouped by session.

#### 2. Tests

**File**: `src/test/java/com/example/gymtrack/workout/ProgressionControllerTest.java`

**Intent**: Lock the metric definition and isolation.

**Contract**: cases — first-ever set yields exactly one point; two sets in one session at different weights yield one point with the larger weight; two sessions yield two ordered points; another user's sets never appear; deleting the top set lowers the point; unknown exercise 404; 401 without token.

### Success Criteria:

#### Automated Verification:

- Progression tests pass: `./mvnw test -Dtest=ProgressionControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Logging sets across two sessions locally returns the expected series from the endpoint.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Frontend workout flow

### Overview

Replace the dashboard placeholder with the working session UI (without the chart yet).

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed functions for the new endpoints built on `authFetch`, setting `Content-Type: application/json` for bodies and handling the 204 from `current`.

**Contract**: `getExercises()`, `startSession()`, `getCurrentSession()` (returns `null` on 204), `endSession(id)`, `logSet(sessionId, {exerciseId, reps, weightKg})`, `deleteSet(sessionId, setId)`, `getProgression(exerciseId)`; exported types mirror the Phase 2–3 DTOs.

#### 2. Workout page and components

**Files**: `frontend/src/pages/WorkoutPage.tsx` (replaces `DashboardPage.tsx`, which is deleted), `frontend/src/components/ExercisePicker.tsx`, `SetLogger.tsx`, `SessionSetList.tsx`, `frontend/src/styles/workout.css`; `frontend/src/App.tsx` route `/` points at `WorkoutPage`.

**Intent**: On load, fetch the current session; with none show a "Start workout" button, with one show the exercise picker, the set form (reps, weight kg with 0.5 step), the session's logged sets with a delete action behind an explicit confirm, and an "End workout" button. Surface API errors from the `{"error"}` body inline. Touch-friendly sizes (large inputs/buttons, numeric `inputmode`).

**Contract**: page state = `{session | null, selectedExercise, loading, error}`; after each successful log/delete the session is updated from the response/refetch; ending a session returns the page to the "Start workout" state.

### Success Criteria:

#### Automated Verification:

- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Start → pick exercise → log a set → see it listed; reload the page and the active session and its sets are still there.
- Deleting a set asks for confirmation and removes it only after confirming.
- Ending the workout returns to the "Start workout" state; invalid input (0 reps, weight not a 0.5 multiple) shows the server error without losing the form.
- Usable at phone width (about 375 px) with touch targets comfortably tappable.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Frontend progression chart

### Overview

Show the per-exercise chart and keep it live as sets change.

### Changes Required:

#### 1. Dependency

**File**: `frontend/package.json` (and lockfile)

**Intent**: Add `recharts` for a responsive line chart.

**Contract**: `recharts` in `dependencies`; must work with the installed React 19.

#### 2. Chart component and wiring

**Files**: `frontend/src/components/ProgressionChart.tsx`, `frontend/src/styles/workout.css`, `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Render `getProgression(selectedExercise)` as a line chart (x = date, y = top weight kg) beneath the set logger; refetch after every successful log or delete and when the selected exercise changes, with no page reload.

**Contract**: `ProgressionChart({ exerciseId, refreshKey })`; renders a visible dot for a single point (US-01 AC), an explicit empty state for zero points, a loading state, and an inline error state; chart fills container width and is readable at phone width.

### Success Criteria:

#### Automated Verification:

- Lint passes: `cd frontend && npm run lint`
- Type check and build pass: `cd frontend && npm run build`

#### Manual Verification:

- Logging the first-ever set for an exercise shows a one-point chart (not blank or error).
- Logging another set at a higher weight updates the chart immediately without reload; deleting it lowers/removes the point.
- After ending the session and starting a new one, the chart shows one point per session.
- A second account sees none of the first account's points.
- Logging feels immediate (visible acknowledgement within about one second on local run).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

- Backend logic is covered through integration tests (the repo has no unit-only layer for domain code); weight-step validation and ownership rules are exercised via MockMvc cases above.

### Integration Tests:

- `WorkoutSchemaTest`, `WorkoutSessionControllerTest`, `WorkoutSetControllerTest`, `ProgressionControllerTest` on Testcontainers Postgres, including cross-user isolation and the single-point case.

### Manual Testing Steps:

1. Register, start a workout, log a set on Barbell Bench Press: chart shows one point.
2. Log a heavier set: point rises without reload. Delete it with confirmation: point drops.
3. Reload mid-workout: session and sets persist. End the workout; start another and log: chart has two points.
4. Log in as a second user: no sessions or points from the first user.

## Performance Considerations

Small data volume (PRD `target_scale`). Per-set logging is one POST plus one progression GET; indexes on `session_id`, `exercise_id` and `(user_id, started_at)` keep both cheap. Acknowledgement target is about one second (PRD NFR).

## Migration Notes

V4 applies only where Flyway runs (local, tests). Production keeps `ddl-auto=update` and Flyway off (`fly.toml:16-17`), so deploying this slice there would create tables from entities without the partial unique index or CHECKs; enabling Flyway in production is a separate decision (noted in the F-02 plan) and not part of this change.

## References

- Related research: `context/changes/core-workout-logging-loop/research.md`
- Roadmap: `context/foundation/roadmap.md` (S-01); PRD: `context/foundation/prd.md` (US-01, FR-004–006, FR-010)
- Controller/test patterns: `src/main/java/com/example/gymtrack/exercise/ExerciseController.java:17-24`, `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java:30-54`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data model

#### Automated

- [x] 1.1 Schema test passes (migration applies, Hibernate `validate` succeeds): `./mvnw test -Dtest=WorkoutSchemaTest`
- [x] 1.2 Full backend suite still passes: `./mvnw test`

#### Manual

- [x] 1.3 App starts against local Postgres with the new migration: `./mvnw spring-boot:run -Dspring-boot.run.profiles=local`

### Phase 2: Session and set API

#### Automated

- [ ] 2.1 Session lifecycle tests pass: `./mvnw test -Dtest=WorkoutSessionControllerTest`
- [ ] 2.2 Set tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest`
- [ ] 2.3 Full backend suite passes: `./mvnw test`

#### Manual

- [ ] 2.4 With the app running locally, a curl/HTTP-client flow (register → start → log set → end) returns the documented statuses and bodies

### Phase 3: Progression endpoint

#### Automated

- [ ] 3.1 Progression tests pass: `./mvnw test -Dtest=ProgressionControllerTest`
- [ ] 3.2 Full backend suite passes: `./mvnw test`

#### Manual

- [ ] 3.3 Logging sets across two sessions locally returns the expected series from the endpoint

### Phase 4: Frontend workout flow

#### Automated

- [ ] 4.1 Lint passes: `cd frontend && npm run lint`
- [ ] 4.2 Type check and build pass: `cd frontend && npm run build`

#### Manual

- [ ] 4.3 Start → pick exercise → log a set → see it listed; reload and the active session and its sets are still there
- [ ] 4.4 Deleting a set asks for confirmation and removes it only after confirming
- [ ] 4.5 Ending the workout returns to the "Start workout" state; invalid input shows the server error without losing the form
- [ ] 4.6 Usable at phone width (about 375 px) with touch targets comfortably tappable

### Phase 5: Frontend progression chart

#### Automated

- [ ] 5.1 Lint passes: `cd frontend && npm run lint`
- [ ] 5.2 Type check and build pass: `cd frontend && npm run build`

#### Manual

- [ ] 5.3 Logging the first-ever set for an exercise shows a one-point chart (not blank or error)
- [ ] 5.4 Logging a heavier set updates the chart immediately without reload; deleting it lowers/removes the point
- [ ] 5.5 After ending the session and starting a new one, the chart shows one point per session
- [ ] 5.6 A second account sees none of the first account's points
- [ ] 5.7 Logging feels immediate (visible acknowledgement within about one second on local run)
