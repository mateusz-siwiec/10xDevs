# Workout Dashboard Implementation Plan

## Overview

Add a dashboard that summarises the user's recent training: number of completed workouts, total time spent, and total volume (Σ reps × kg) over a rolling 7- or 30-day window. A new read-only endpoint `GET /api/dashboard/stats?days=7|30` computes the aggregates server-side; a new `DashboardPage` becomes the post-login screen at `/`, and the existing `WorkoutPage` moves to `/workout`.

## Current State Analysis

Frame verdict (confirmed, confidence HIGH — `frame.md`): the user has no view of aggregated progress, and the data to build one already exists. The initial framing was correct; no reframing.

- Sessions carry `startedAt` / nullable `endedAt` (`WorkoutSession.java:25-28`); sets carry `reps` (1–100) and `weightKg` (> 0), both `not null` (`V4__create_workout_sessions_and_sets.sql:18-19`). No schema change is needed.
- The only existing aggregate is max weight per exercise (`WorkoutSetRepository.java:17-24`); nothing is aggregated per user or per period.
- `/` renders `WorkoutPage`, which is both the post-login landing and the start/run-session screen (`App.tsx:17-23`, `WorkoutPage.tsx`). `LoginPage` and `RegisterPage` both `navigate('/')` after success (`LoginPage.tsx:21`, `RegisterPage.tsx:21`). `Topbar` links to `/` ("Workout") and `/plans`.
- At most one active session per user (`WorkoutSessionRepository.java:10`); an abandoned session stays with `endedAt = null` indefinitely.
- Not in the PRD or roadmap M-1 (`prd.md:73-151`, `roadmap.md` At-a-glance table). It is a new slice outside the M-1 list.

## Desired End State

After logging in, the user lands on `/` and sees "Last 7 days / Last 30 days" totals for completed workouts, time spent and volume, with a button to start/continue a workout at `/workout`. A new user with no completed sessions sees zeros and a prompt to log a first workout.

Verify: `./mvnw test` green including the new dashboard tests; `npm run build` and `npm run lint` clean; manual walkthrough below.

### Key Discoveries:

- Aggregation pattern to follow: `@Query` in `WorkoutSetRepository.java:17-24` + a thin controller like `ProgressionController.java`.
- Controller tests use `@SpringBootTest` + MockMvc + Testcontainers Postgres (`ProgressionControllerTest.java:30-45`) — copy this setup.
- `/api/**` is authenticated by default (`SecurityConfig.java:48`), so the endpoint needs no security change.
- Errors use the `{"error": ...}` shape (`CommonExceptionHandler.java`).
- Frontend API calls go through `authFetch` in `frontend/src/api/client.ts`; pages use `page-shell` / `page-card` styles from `styles/page.css`.

## What We're NOT Doing

- No charts, week-over-week comparison, personal records, or per-muscle-group breakdown.
- No calendar-week boundaries or per-user timezones — windows are rolling (`now − N days`).
- No "Continue workout" banner for an active session (the dashboard just links to `/workout`, which already handles an active session).
- No new tables or migrations; no change to how sessions or sets are written.
- Trailing/active (unended) sessions are excluded from every metric — no `now − startedAt` estimates.

## Implementation Approach

Server computes everything for one window from completed sessions only (`endedAt` within the window), so all three numbers describe the same set of sessions. The frontend renders three tiles and a 7/30 toggle. Backend first so it is verifiable in isolation; the route move and UI follow in one frontend phase.

## Phase 1: Backend dashboard stats endpoint

### Overview

Expose per-user aggregates for a rolling window, with integration tests.

### Changes Required:

#### 1. Aggregate queries

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java`, `WorkoutSetRepository.java`

**Intent**: Provide the data for the three metrics, scoped to the user and to sessions ended since a cutoff instant.

**Contract**: sessions repository gains a finder returning the user's sessions with `endedAt >= :since` (implies `endedAt` not null); sets repository gains a `@Query` returning `coalesce(sum(s.reps * s.weightKg), 0)` over sets whose `session.userId = :userId and session.endedAt >= :since`. Count and duration are derived from the finder result (data volume is small per the PRD).

#### 2. Service, response and controller

**File**: `src/main/java/com/example/gymtrack/workout/DashboardStatsResponse.java`, `DashboardService.java` (or a method on `WorkoutService`), `DashboardController.java`

**Intent**: Turn the window into a cutoff, assemble the metrics, and serve them at a protected GET endpoint.

**Contract**: `GET /api/dashboard/stats?days=7|30` (default `7`) → `{ "days": int, "workoutCount": long, "totalDurationSeconds": long, "totalVolumeKg": number }`. `since = now − days`. Any `days` other than 7 or 30 returns 400 `{"error": ...}` in the existing handler style (`WorkoutExceptionHandler` / `CommonExceptionHandler`). A user with no qualifying sessions gets zeros, never an error. Duration per session is `endedAt − startedAt`, summed.

#### 3. Tests

**File**: `src/test/java/com/example/gymtrack/workout/DashboardControllerTest.java`

**Intent**: Pin the window, the active-session exclusion and the isolation between users.

**Contract**: Testcontainers/MockMvc setup as in `ProgressionControllerTest`. Cases: empty user → zeros; one ended session with known sets → exact count, volume (e.g. 5×100 + 3×50 = 650) and duration; a still-active session with sets is excluded from all three metrics; a session ended outside the window is excluded for `days=7` but included for `days=30` (set `endedAt` via repository/JDBC since `end()` uses `Instant.now()`); another user's data never leaks; `days=14` → 400; no token → 401.

### Success Criteria:

#### Automated Verification:

- New and existing backend tests pass: `./mvnw test`
- Dashboard test class passes on its own: `./mvnw test -Dtest=DashboardControllerTest`

#### Manual Verification:

- With `podman-compose up -d` and the `local` profile, `GET /api/dashboard/stats?days=7` with a real token returns plausible numbers after ending a short workout
- `days=14` returns 400 with an `error` message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend dashboard page and routing

### Overview

Render the stats and make the dashboard the post-login screen.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to the new endpoint through `authFetch`.

**Contract**: `interface DashboardStats { days: number; workoutCount: number; totalDurationSeconds: number; totalVolumeKg: number }` and `getDashboardStats(days: 7 | 30): Promise<DashboardStats>`.

#### 2. Dashboard page

**File**: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/styles/dashboard.css`

**Intent**: Show the three metrics for the selected window with loading, error and empty states, and a clear entry into training.

**Contract**: 7/30-day toggle (default 7); three tiles — Workouts (count), Time (formatted `h m`), Volume (kg, grouped digits); empty state when `workoutCount === 0` ("No completed workouts yet…"); error text in the existing `error-text` style; a `Link` to `/workout` styled as the primary button. Refetch on toggle with a cancelled flag to drop stale responses (same pattern as `ProgressionChart.tsx`). Reuse `page-shell` / `page-card`.

#### 3. Routing and navigation

**File**: `frontend/src/App.tsx`, `frontend/src/components/Topbar.tsx`

**Intent**: Put the dashboard on `/` and keep the workout screen reachable.

**Contract**: `/` → `<RequireAuth><DashboardPage/></RequireAuth>`; `/workout` → `WorkoutPage`; `Topbar` gets "Dashboard" (`to="/"`, `end`) and "Workout" (`to="/workout"`) links plus the existing "Plans". `LoginPage` / `RegisterPage` keep `navigate('/')` and now land on the dashboard. No other component links to `/` expecting the workout screen (verify with a grep for `to="/"` and `navigate('/')`).

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Logging in lands on the dashboard; a new account shows zeros and the empty-state prompt
- After finishing a workout via `/workout`, the dashboard totals match the logged sets (Σ reps × kg) and the session duration
- 7/30 toggle changes the numbers when older sessions exist; a still-running session is not counted
- Topbar navigation works between Dashboard, Workout and Plans; "Start workout" button reaches `/workout`
- Layout is usable at phone width

---

## Testing Strategy

### Unit Tests:

- Volume and duration arithmetic, window boundary (inside/outside), active-session exclusion — covered by the integration tests in Phase 1 (no separate unit layer; logic is thin).

### Integration Tests:

- `DashboardControllerTest` (Phase 1) over real Postgres via Testcontainers.

### Manual Testing Steps:

1. Register a fresh user → land on the dashboard with zeros.
2. Start a workout, log a couple of sets, end it → dashboard shows 1 workout and the expected volume.
3. Start another workout, log a set, do not end it → dashboard numbers do not change.
4. Toggle 7 / 30 days.

## Performance Considerations

Two per-user queries per request over small per-user data (PRD `data_volume: small`); no caching needed. If sessions grow large, a single `sum`/`count` SQL with `extract(epoch …)` can replace the Java-side duration sum.

## Migration Notes

None — no schema changes. Existing bookmarks to `/` now open the dashboard instead of the workout screen.

## References

- Frame brief: `context/changes/workout-dashboard/frame.md`
- Similar implementation: `src/main/java/com/example/gymtrack/workout/ProgressionController.java`, `WorkoutSetRepository.java:17-24`, `frontend/src/components/ProgressionChart.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend dashboard stats endpoint

#### Automated

- [x] 1.1 New and existing backend tests pass: `./mvnw test` — be437a7
- [x] 1.2 Dashboard test class passes on its own: `./mvnw test -Dtest=DashboardControllerTest` — be437a7

#### Manual

- [x] 1.3 `GET /api/dashboard/stats?days=7` with a real token returns plausible numbers after ending a short workout — be437a7
- [x] 1.4 `days=14` returns 400 with an `error` message — be437a7

### Phase 2: Frontend dashboard page and routing

#### Automated

- [x] 2.1 Frontend builds: `cd frontend && npm run build` — 3baa2c2
- [x] 2.2 Lint passes: `cd frontend && npm run lint` — 3baa2c2

#### Manual

- [x] 2.3 Logging in lands on the dashboard; a new account shows zeros and the empty-state prompt — 3baa2c2
- [x] 2.4 After finishing a workout, dashboard totals match logged sets and session duration — 3baa2c2
- [x] 2.5 7/30 toggle changes numbers when older sessions exist; a running session is not counted — 3baa2c2
- [x] 2.6 Topbar navigation works between Dashboard, Workout and Plans; "Start workout" reaches `/workout` — 3baa2c2
- [x] 2.7 Layout is usable at phone width — 3baa2c2
