# Training History Implementation Plan

## Overview

Add a Training history page: a paginated list of the user's ended workouts (newest first) with an optional plan filter, and a compact view of one workout. Each row shows date, plan, duration, sets and volume; a row opens `/history/:id`, which lists the sets grouped per exercise in logged order. Roadmap slice S-13, anchor MS-03.

## Current State Analysis

No frame or research doc exists; scope comes from roadmap S-13 and the planning interview.

- `workout_sessions` has `startedAt`, nullable `endedAt` and nullable `planId` (`WorkoutSession.java`); `planId` is cleared when its plan is deleted, so free-form and deleted-plan workouts are indistinguishable. `workout_sets` has `exerciseId`, `reps`, `weightKg`, `loggedAt` (`WorkoutSet.java`).
- Session endpoints are only start, current, end and set logging (`WorkoutController.java`); nothing lists or fetches past sessions. `SessionResponse` / `SetResponse` exist but carry no aggregates.
- `DashboardService` already derives duration (`endedAt - startedAt`) and volume (`sum(reps * weightKg)`, `WorkoutSetRepository.sumVolumeSince`) for ended sessions; the history numbers must agree with it.
- No `Page` / `Slice` usage exists in the repo yet (`PageRequest` is only used for size-1 pages), so this slice sets the paging convention. Bad parameters map to 400 `{"error": ...}` through `WorkoutExceptionHandler` (see `InvalidDashboardWindowException`).
- Read-only endpoint + test patterns: `PreviousWorkoutController` / `PreviousWorkoutControllerTest` (Testcontainers + MockMvc, repositories for fixtures, `Thread.sleep` to order `endedAt`). `/api/**` is authenticated by default.
- Frontend: routes in `App.tsx` (`/`, `/workout`, `/plans`, ...) wrapped in `RequireAuth`; `Topbar.tsx` holds the nav; `DashboardPage.tsx` is the pattern for a fetching page (cancelled-flag effect, `aria-live` body, `page-card` styles); `client.ts` has `listPlans()` and `getExercises()` for names.
- Review lessons already applied elsewhere: deterministic tiebreaker on "newest" queries; persistent `aria-live` wrapper for late content; stale responses dropped by key.

## Desired End State

A "History" link in the topbar opens `/history`: ended workouts newest first, 20 per page with Prev / Next and "Page N of M", filterable by plan ("All workouts", each current plan, "No plan"). Rows show date, plan name (if any), duration, set count and volume. Clicking a row opens `/history/:id` showing the workout header and, per exercise, its sets as "Set N: reps × kg". Running sessions never appear. Verify: `./mvnw test` green with the new test class; `npm run build` and `npm run lint` clean; manual walkthrough below.

### Key Discoveries:

- "Past workout" = an **ended** session of the caller; running sessions are excluded from list and detail (they live on the workout screen).
- Paging and ordering: `endedAt desc, startedAt desc, id desc`, page index 0-based, default size 20, max 50.
- Aggregates are computed per page, not per row: page the sessions first, then fetch count/volume for just those ids in one grouped query (avoids `group by` + `Page` count-query pitfalls and N+1).
- Plan filter has three forms (all / one plan / no plan); implemented as three repository methods rather than nullable-UUID JPQL parameters, which Postgres cannot type-infer.
- A plan filter value that is not the caller's matches nothing (empty page, 200), never an error or a leak.
- Plan names are resolved in one batch scoped to the caller; the current plan name is shown (renames are reflected).

## What We're NOT Doing

- No editing or adding workouts (S-14), no deleting workouts.
- No date-range, exercise or text filters; no sorting options.
- No schema change and no snapshot of plan name or targets on the session.
- No charts or per-exercise summary numbers (volume/top set) in the compact view.
- No infinite scroll or "load more"; no cursor paging.
- No change to the workout screen, dashboard or existing endpoints.

## Implementation Approach

Backend first so it is verifiable in isolation: a history service exposes a paged, filtered list with per-session aggregates and a detail lookup, behind two read-only endpoints on a new controller. Then a list page that keeps page and plan filter in the URL query string (so back from a detail page restores the position), then the detail page. Exercise names come from the existing `getExercises()`; the API returns exercise ids only.

## Phase 1: Backend history API

### Overview

Paged, plan-filterable list of ended workouts with aggregates, and a detail endpoint, with integration tests.

### Changes Required:

#### 1. Repository queries

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java`, `WorkoutSetRepository.java`

**Intent**: Page ended sessions of a user (all / one plan / no plan) and aggregate sets for a page of sessions.

**Contract**: Three `Page<WorkoutSession>` methods taking `Pageable` — ended sessions of `userId` (a) unfiltered, (b) with `planId = :planId`, (c) with `planId is null`; each ordered by `endedAt desc, startedAt desc, id desc` (the `Pageable` carries that `Sort`). One `WorkoutSetRepository` query returning, for a collection of session ids, `(sessionId, setCount, volumeKg)` via a constructor projection grouped by session (`coalesce(sum(reps * weightKg), 0)`); sessions without sets are absent from the result and treated as 0 / 0 by the service.

#### 2. Service and responses

**File**: `src/main/java/com/example/gymtrack/workout/HistoryService.java` (new), `HistoryPageResponse.java` (new), `HistoryItemResponse.java` (new), `HistoryDetailResponse.java` (new), `InvalidHistoryQueryException.java` (new)

**Intent**: Build the list page and the detail view for the caller.

**Contract**: `@Transactional(readOnly = true)` methods `HistoryPageResponse list(UUID userId, int page, int size, UUID planId, boolean noPlan)` and `HistoryDetailResponse detail(UUID userId, UUID sessionId)`.
- `list`: `page >= 0`, `1 <= size <= 50`, and `planId` together with `noPlan` are rejected with `InvalidHistoryQueryException` (message names the parameter). Chooses the repository method from the filter, loads aggregates for the page's ids in one query, resolves plan names for the distinct non-null `planId`s via the plan repository scoped to `userId` (unknown/deleted/foreign plan → `planName` null). Duration = seconds between `startedAt` and `endedAt` (same as `DashboardService`).
- Records: `HistoryPageResponse { items, page, size, totalElements, totalPages }`; `HistoryItemResponse { id, startedAt, endedAt, planId, planName, durationSeconds, setCount, volumeKg }`; `HistoryDetailResponse { id, startedAt, endedAt, planId, planName, durationSeconds, volumeKg, exercises }` with `exercises` a list of `{ exerciseId, sets: [{ reps, weightKg }] }` grouped by exercise, exercises ordered by their first set's `loggedAt`, sets in `loggedAt` order.
- `detail`: only the caller's **ended** sessions; unknown, foreign or running session → `WorkoutNotFoundException("Workout session not found")`.

#### 3. Controller and error mapping

**File**: `src/main/java/com/example/gymtrack/workout/HistoryController.java` (new), `WorkoutExceptionHandler.java`

**Intent**: Expose the two reads to the authenticated user and map invalid queries to 400.

**Contract**: `GET /api/workout-sessions?page=0&size=20&planId=<uuid>&noPlan=true` → `200 HistoryPageResponse` (`page` default 0, `size` default 20, `planId` and `noPlan` optional); `GET /api/workout-sessions/{id}` → `200 HistoryDetailResponse` or 404. User id from `@AuthenticationPrincipal CurrentUser`. `InvalidHistoryQueryException` → 400 `{"error": ...}` via a new handler method next to `InvalidDashboardWindowException`; a malformed `planId` / `id` / `page` / `size` returns 400 `{"error": "Invalid <name>"}` through the existing type-mismatch handler. `GET /api/workout-sessions/current` must keep working (literal path wins over `{id}`).

#### 4. Tests

**File**: `src/test/java/com/example/gymtrack/workout/HistoryControllerTest.java` (new)

**Intent**: Pin every branch of list and detail.

**Contract**: Testcontainers + MockMvc setup as in `PreviousWorkoutControllerTest`; plans via `TrainingPlanRepository`, sessions/sets via repositories. Cases — list: ended sessions newest first with correct `setCount`, `volumeKg` and `durationSeconds`; a running session is excluded; a session with no sets appears with 0 sets and 0 volume; paging (`size=2` over 5 sessions gives pages of 2/2/1, correct `totalElements`/`totalPages`, page beyond the end is empty 200); default size 20; `size` over 50, `size=0`, negative `page`, and `planId` + `noPlan` together → 400 with `error`; malformed `planId` → 400; plan filter returns only that plan's sessions; `noPlan=true` returns free-form and deleted-plan sessions; another user's `planId` returns an empty page; plan name present for a live plan and null for a deleted one; other users' sessions never leak. Detail: sets grouped per exercise with exercises in first-logged order and sets in logged order; running session → 404; another user's session → 404; unknown id → 404; no token → 401 for both endpoints. `GET /api/workout-sessions/current` still returns 204 with no active session.

### Success Criteria:

#### Automated Verification:

- Backend tests pass: `./mvnw test`
- New test class passes on its own: `./mvnw test -Dtest=HistoryControllerTest`

#### Manual Verification:

- With the `local` profile and a real token, the list endpoint returns ended workouts newest first with sensible duration, set count and volume, and `?page=1&size=2` pages correctly
- `planId=<plan>` and `noPlan=true` filter as specified, and the detail endpoint returns the grouped sets of one workout

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend history list

### Overview

A `/history` page listing workouts with plan filter and Prev / Next paging, reachable from the topbar.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to the list endpoint.

**Contract**: `HistoryItem` and `HistoryPage` interfaces mirroring the response and `getHistory(page: number, plan: { planId?: string; noPlan?: boolean }): Promise<HistoryPage>` building the query string (`page`, optional `planId` / `noPlan=true`), using `authFetch` like its siblings.

#### 2. List page

**File**: `frontend/src/pages/HistoryPage.tsx` (new), `frontend/src/styles/history.css` (new)

**Intent**: Show the paged list with a plan filter, and keep position across navigation.

**Contract**: Page and filter live in the URL query (`useSearchParams`: `page` 1-based in the URL, `plan` = absent / plan id / `none`). Fetch on change with the cancelled-flag pattern of `DashboardPage.tsx`, keeping the result keyed by `page:plan` so a stale response is never shown. Plan dropdown ("All workouts", each plan from `listPlans()`, "No plan"; a failing `listPlans()` leaves just "All workouts" and "No plan"). Each row is a link to `/history/:id` showing date (`d MMM yyyy`), plan name when present, duration (same `1h 5m` / `<1m` format as the dashboard), set count and volume. Prev / Next buttons disabled at the ends with "Page N of M"; changing the filter resets to page 1; an out-of-range page from the URL shows the empty state. States: loading text, empty ("No completed workouts yet" / "…for this filter"), error with `role="alert"`; the body sits in a persistent `<div aria-live="polite">`. Use the existing `page-shell` / `page-card` styles; usable at phone width.

#### 3. Route and nav

**File**: `frontend/src/App.tsx`, `frontend/src/components/Topbar.tsx`

**Intent**: Make the page reachable.

**Contract**: `<Route path="/history">` wrapped in `RequireAuth`, and a "History" `NavLink` to `/history` in the topbar after "Workout".

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- The History link opens the list: newest first, each row shows date, plan, duration, sets and volume
- Prev / Next page correctly and disable at the ends; the page survives reload and browser back
- Plan filter works for a plan, "No plan" and "All workouts", and resets to page 1
- Empty account / empty filter shows the empty message; an API error shows an alert and the rest of the app still works
- Layout is usable at phone width

---

## Phase 3: Frontend compact workout view

### Overview

A `/history/:id` page showing how one workout went, linked from each list row.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Typed access to the detail endpoint.

**Contract**: `HistoryDetail` interface and `getHistorySession(id: string): Promise<HistoryDetail>` via `authFetch`.

#### 2. Detail page

**File**: `frontend/src/pages/HistoryDetailPage.tsx` (new), `frontend/src/styles/history.css`, `frontend/src/App.tsx`

**Intent**: Show the workout header and per-exercise sets.

**Contract**: `<Route path="/history/:id">` inside `RequireAuth`. Fetch the detail and `getExercises()` together (cancelled-flag pattern); header shows date, plan name (if any), duration and total volume; below, one section per exercise (name from the exercise list, "Unknown exercise" fallback) with the sets as a numbered list "Set N: reps × weightKg kg" in logged order — same format as the S-12 hint (`PreviousWorkoutHint.tsx`). A "Back to history" link to `/history` (browser back also restores the list thanks to URL state). A 404 shows "Workout not found" with the same link; other errors show an alert. Persistent `aria-live` wrapper like the other pages. A workout with no sets shows "No sets were logged in this workout."

### Success Criteria:

#### Automated Verification:

- Frontend builds: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- Clicking a row opens the workout with date, plan, duration, volume and every exercise's sets in logged order
- Back to history (link and browser back) returns to the same page and filter
- A running or non-existent workout id shows "Workout not found"; an error leaves the app usable
- Layout is usable at phone width

---

## Testing Strategy

### Unit Tests:

- Thin logic, covered through the integration tests in Phase 1; no separate unit layer.

### Integration Tests:

- `HistoryControllerTest` (Phase 1) over real Postgres via Testcontainers.

### Manual Testing Steps:

1. Log in with an account that has several ended workouts, some from a plan, some free-form, one with a deleted plan.
2. Open History: check order, row contents against the dashboard totals, and paging with a small data set.
3. Filter by a plan, then "No plan", then back to "All"; reload and use the browser back button.
4. Open a workout and compare its sets with what you logged; try a made-up id in the URL.
5. Check phone width.

## Performance Considerations

Per request: one page query, one count, one grouped aggregate over at most 50 session ids and one batch plan lookup — no N+1. Offset paging is fine at the PRD's data volume. No caching.

## Migration Notes

None — no schema changes. Existing sessions already carry everything needed. Known limitation: a session of a deleted plan shows no plan name and falls under the "No plan" filter.

## References

- Roadmap: `context/foundation/roadmap.md` (S-13, MS-03)
- Similar implementation: `src/main/java/com/example/gymtrack/workout/DashboardService.java`, `PreviousWorkoutController.java`, `PreviousWorkoutControllerTest.java`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/PreviousWorkoutHint.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend history API

#### Automated

- [x] 1.1 Backend tests pass: `./mvnw test` — cbe015a
- [x] 1.2 New test class passes on its own: `./mvnw test -Dtest=HistoryControllerTest` — cbe015a

#### Manual

- [x] 1.3 List endpoint returns ended workouts newest first with sensible duration, set count and volume, and pages correctly — cbe015a
- [x] 1.4 planId and noPlan filter as specified, and the detail endpoint returns the grouped sets of one workout — cbe015a

### Phase 2: Frontend history list

#### Automated

- [x] 2.1 Frontend builds: `cd frontend && npm run build`
- [x] 2.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [x] 2.3 The History link opens the list: newest first, each row shows date, plan, duration, sets and volume
- [x] 2.4 Prev / Next page correctly and disable at the ends; the page survives reload and browser back
- [x] 2.5 Plan filter works for a plan, "No plan" and "All workouts", and resets to page 1
- [x] 2.6 Empty states show the right message; an API error shows an alert and the rest of the app still works
- [x] 2.7 Layout is usable at phone width

### Phase 3: Frontend compact workout view

#### Automated

- [ ] 3.1 Frontend builds: `cd frontend && npm run build`
- [ ] 3.2 Lint passes: `cd frontend && npm run lint`

#### Manual

- [ ] 3.3 Clicking a row opens the workout with date, plan, duration, volume and every exercise's sets in logged order
- [ ] 3.4 Back to history (link and browser back) returns to the same page and filter
- [ ] 3.5 A running or non-existent workout id shows "Workout not found"; an error leaves the app usable
- [ ] 3.6 Layout is usable at phone width
