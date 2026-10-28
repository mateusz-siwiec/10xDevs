# Dashboard Insights Implementation Plan

## Overview

Turn the dashboard from three totals into a trend-aware view: a comparison against the previous period on each tile, 90-day and All-time windows, a 12-week volume chart, the latest personal records, and a weekly streak with a user-set weekly workout goal. Weeks are rolling 7-day blocks (no calendar or timezone), and the goal is stored on the user.

## Current State Analysis

- `GET /api/dashboard/stats?days=7|30` returns `days`, `workoutCount`, `totalDurationSeconds`, `totalVolumeKg` over sessions that ended in `[now - N days, now]`. Active sessions never count (`DashboardService.java:31-43`). Anything else is a 400 via `InvalidDashboardWindowException` (`WorkoutExceptionHandler.java:22`).
- The archived dashboard plan chose rolling windows on purpose to avoid timezone and week-start decisions, and listed charts, comparison and PRs as out of scope.
- Repository queries only take a lower bound (`WorkoutSessionRepository.findEndedSince`, `WorkoutSetRepository.sumVolumeSince`); there is no range query, so a previous window cannot be computed yet.
- `PersonalRecordService` decides records per session: strictly greater Epley score `weight x (30 + reps)` than every earlier eligible set (reps <= 12), the first eligible set of an exercise is never flagged (`PersonalRecordService.java:27-67`). Nothing computes records across sessions.
- `users` has no settings; `User` has no setters (`User.java`). Migrations are at V8; production runs `ddl-auto=update` with Flyway off.
- `recharts` ^3.10.1 is already a dependency and used in `ProgressionChart.tsx` (theme tokens `var(--border)`, `var(--accent)`, `ResponsiveContainer`, `isAnimationActive={false}`).
- `DashboardPage.tsx` holds `days: 7 | 30` state, fetches stats per toggle with a cancelled-flag effect, and renders three `dashboard-tile` blocks.

## Desired End State

The dashboard shows, for a 7 / 30 / 90 / All toggle: the three tiles with a percentage change against the previous equal-length window (hidden on All and when the previous value is zero); a bar chart of volume for the last 12 rolling weeks; the 5 most recent personal records over the user's whole history; and a consistency block with the current streak and "X of goal this week", where the goal can be set or cleared. Verified by backend integration tests and a manual pass in the browser.

### Key Discoveries:

- The PR rule lives in one service; the dashboard must reuse its eligibility and score so History and Dashboard never disagree (`PersonalRecordService.java:69-75`).
- Existing dashboard tests pin session times with `setTimes` and use `days=abc|0|14` for 400s; widening `days` to a string must keep those 400s (`DashboardControllerTest.java:93-157`).
- Window anchor stays "session ended in window" so one session set drives count, time and volume, and the chart buckets follow the same anchor.
- A nullable `integer` column is created by `ddl-auto=update` in production without manual SQL; only constraints and indexes need a manual step, so the goal range is validated in the API and no DB constraint is added.

## What We're NOT Doing

- Calendar weeks, week-start choice, or user timezones.
- Muscle-group balance, per-exercise progress charts, plan adherence, heatmap.
- Stored PR flags or a records page; recent PRs are derived on read.
- Counting the active session in any metric or in the PR list.
- A second streak definition (any-workout streak) or comparison on the All view.
- Caching or SQL-side aggregation; per-user data is small and aggregated in Java as today.

## Implementation Approach

Backend first, in two phases that each end green, then the UI against a stable API. Window math is expressed once as a half-open range `[from, to)` on `endedAt` so current and previous windows share the same two repository queries. Insights is a separate endpoint from stats so the toggle refetches only the cheap stats while the chart, streak and PRs load once. The weekly blocks, streak and PR scan are computed in Java from three small per-user reads (ended session end times and volumes, eligible sets).

Week block `k` is `[now - (k+1)*7d, now - k*7d)`; `k = 0` is the current block. Streak: with goal `g`, walk blocks from `k = 1` while count >= `g`; if block 0 also meets `g`, add 1. Example, goal 3 with counts k0=1, k1=3, k2=4, k3=2 gives streak 2; with k0=3 it gives 3. Goal null gives streak 0 and the UI prompts to set one.

## Phase 1: Backend — windows and comparison

### Overview

`/api/dashboard/stats` supports `days=7|30|90|all` and returns the previous equal-length window.

### Changes Required:

#### 1. Range queries

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSessionRepository.java`, `src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java`

**Intent**: Replace the lower-bound-only queries used by the dashboard with range variants so the previous window can be computed; remove the old ones if nothing else uses them.

**Contract**: `findEndedBetween(userId, from, to)` returns sessions with `from <= endedAt < to`; `sumVolumeBetween(userId, from, to)` returns `coalesce(sum(reps * weightKg), 0)` over sets of such sessions.

#### 2. Stats service and response

**File**: `src/main/java/com/example/gymtrack/workout/DashboardService.java`, `DashboardStatsResponse.java`, `DashboardController.java`

**Intent**: Accept `all` and `90`, compute the current window `[now - N, now)` and the previous `[now - 2N, now - N)`, and return both. `All` uses `Instant.EPOCH` as the lower bound and has no previous window. The `days` request param becomes a string so `all` parses; any other value than `7|30|90|all` still throws `InvalidDashboardWindowException` (400 with `error`).

**Contract**: `DashboardStatsResponse(Integer days, long workoutCount, long totalDurationSeconds, BigDecimal totalVolumeKg, DashboardPeriodTotals previous)`; `days` is `null` for All. `DashboardPeriodTotals(long workoutCount, long totalDurationSeconds, BigDecimal totalVolumeKg)`; `previous` is `null` for All and non-null otherwise (zeros when empty). Default `days` stays `7`.

#### 3. Tests

**File**: `src/test/java/com/example/gymtrack/workout/DashboardControllerTest.java`

**Intent**: Keep all existing assertions and add: previous window totals (a session 10 days ago appears in `previous` for `days=7`, current stays 0), boundary at exactly the window edge, `days=90`, `days=all` (old session included, `previous` null, `days` null), unsupported value still 400, user isolation for `previous`.

### Success Criteria:

#### Automated Verification:

- Dashboard tests pass, old and new: `./mvnw test -Dtest=DashboardControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Against the local API, `days=all` returns `previous: null` and `days=7` returns a `previous` object.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Backend — insights and weekly goal

### Overview

Persist the weekly goal and expose a window-independent insights endpoint.

### Changes Required:

#### 1. Goal column

**File**: `src/main/resources/db/migration/V9__add_user_weekly_goal.sql`, `src/main/java/com/example/gymtrack/user/User.java`

**Intent**: Add a nullable weekly workout goal to users.

**Contract**: `alter table users add column weekly_goal integer;` no constraint. `User` gets a `weeklyGoal` (`Integer`, nullable) field with getter and setter.

#### 2. Goal endpoint

**File**: `src/main/java/com/example/gymtrack/workout/DashboardController.java`, `DashboardService.java`, new request record and invalid-goal exception, `WorkoutExceptionHandler.java`

**Intent**: Let the user set or clear the goal, validated in the API since production has no DB constraint.

**Contract**: `PUT /api/dashboard/weekly-goal` body `{ "weeklyGoal": 1..14 | null }` returns `{ "weeklyGoal": <int|null> }`; any other value (0, 15, non-integer) returns 400 `{ "error": ... }` in the existing handler style. Scoped to the authenticated user.

#### 3. Cross-session PR scan

**File**: `src/main/java/com/example/gymtrack/workout/PersonalRecordService.java`, `WorkoutSetRepository.java`

**Intent**: Add a method that returns the user's most recent record sets across all ended sessions by scanning eligible sets in `loggedAt` order with a running best per exercise, reusing the existing `isEligible` and `score` so the rule is identical to the per-session one. Sets of the active session are not read.

**Contract**: `List<PersonalRecordEntry> recentRecords(UUID userId, int limit)` newest first; `PersonalRecordEntry(sessionId, exerciseId, reps, weightKg, achievedAt)`. Repository query returns eligible sets (reps <= 12) of ended sessions for the user ordered by `loggedAt asc`. Strictly-greater and first-set-not-flagged semantics unchanged.

#### 4. Insights endpoint

**File**: new `DashboardInsightsResponse` records, `DashboardService.java`, `DashboardController.java`

**Intent**: Compute 12 weekly blocks, the streak and the latest 5 records in one call. Weekly volume and counts are assigned by session `endedAt`; exercise names are resolved from `ExerciseRepository` with an "Unknown exercise" fallback.

**Contract**: `GET /api/dashboard/insights` returns `{ weeklyVolume: [{ weekStart, workoutCount, volumeKg }] (12 items, oldest first, `weekStart` is the block's start instant), streak: { goal: int|null, weeks: int, currentWeekWorkouts: int }, recentPersonalRecords: [{ sessionId, exerciseId, exerciseName, reps, weightKg, achievedAt }] (max 5, newest first) }`.

#### 5. Tests

**File**: `src/test/java/com/example/gymtrack/workout/DashboardInsightsControllerTest.java` (new, same Testcontainers setup as `DashboardControllerTest`)

**Intent**: Cover weekly bucketing (a session ended 6 days ago vs 8 days ago lands in blocks 0 and 1; empty weeks are zero-filled to 12 items), the streak example from Implementation Approach, goal null gives streak 0, current block not meeting the goal does not break the streak, goal validation (0, 15, null clears), PR ties are not records, first set is not a record, reps above 12 ignored, active-session sets excluded, PR in insights matches the PR flagged in history detail for the same workout, user isolation.

### Success Criteria:

#### Automated Verification:

- Migration applies and Hibernate `validate` passes: `./mvnw test -Dtest=DashboardInsightsControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the local API, `PUT /api/dashboard/weekly-goal` then `GET /api/dashboard/insights` shows the goal, a 12-item weekly array and plausible PRs for the dev account.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Frontend — dashboard UI

### Overview

Render the new data on the dashboard.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Widen the stats call to `7 | 30 | 90 | 'all'`, add the `previous` block to `DashboardStats`, and add typed `getDashboardInsights` and `setWeeklyGoal`.

**Contract**: Types mirror the Phase 1 and 2 responses exactly (`days: number | null`, `previous: PeriodTotals | null`, `DashboardInsights`).

#### 2. Window toggle and deltas

**File**: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/styles/dashboard.css`

**Intent**: Four-button toggle (7 / 30 / 90 / All). Each tile shows a delta against `previous`: percentage change rounded to a whole number with up/down styling; hidden when `previous` is null (All) or the previous value is 0. Empty-state text reflects the selected window ("in the last N days" vs "yet" for All). Insights are fetched once on mount and independent of the toggle, with their own loading and error states.

**Contract**: delta = `(current - previous) / previous * 100`; no delta when `previous === 0`.

#### 3. New dashboard blocks

**File**: new `frontend/src/components/WeeklyVolumeChart.tsx`, `RecentRecords.tsx`, `ConsistencyCard.tsx`

**Intent**: `WeeklyVolumeChart` is a Recharts `BarChart` of the 12 blocks following the `ProgressionChart` styling (tokens, `ResponsiveContainer`, no animation) with an empty state when all weeks are zero. `RecentRecords` lists up to 5 PRs (exercise, `weight x reps`, relative or short date) with an empty state. `ConsistencyCard` shows the streak in weeks, "X of goal this week", and a small control to set or clear the goal (1-14), disabled while saving, showing the API error text on failure; with no goal it shows a prompt instead of a streak.

**Contract**: Components take their data as props from the page; the goal save updates local insights state on success.

### Success Criteria:

#### Automated Verification:

- Lint passes: `cd frontend && npm run lint`
- Type check and production build pass: `cd frontend && npm run build`

#### Manual Verification:

- Toggling 7 / 30 / 90 / All updates the tiles; deltas show on the first three and are hidden on All.
- The weekly chart shows 12 bars and matches the tiles for the last 7 days.
- Recent PRs matches the PR badges in History for the same workouts.
- Setting a goal updates the streak and "X of goal" immediately; clearing it shows the prompt.
- New user with no data sees sensible empty states; layout holds at phone width.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- No separate unit layer; the repo tests aggregation through MockMvc integration tests on Testcontainers Postgres, as the existing dashboard tests do.

### Integration Tests:

- Window and previous-window boundaries, `all`, validation (Phase 1).
- Weekly buckets, streak rules, goal validation, cross-session PR rule parity with History, active-session exclusion, user isolation (Phase 2).

### Manual Testing Steps:

1. Log and end a few workouts across several days with a dev account, including a heavier set for one exercise.
2. Walk every toggle value and compare tiles and deltas by hand.
3. Set a goal below and above the current week count and watch the streak.
4. Compare Recent PRs with History PR badges.

## Performance Considerations

Insights scans the user's ended-session end times and eligible sets on every load. This is fine at current per-user volumes; if histories grow into the tens of thousands of sets, move the PR scan and bucketing to SQL or cache the result. The toggle does not refetch insights.

## Migration Notes

`V9` is applied automatically locally and in tests. Production skips Flyway, but `ddl-auto=update` adds the nullable `weekly_goal` column on startup, and there is no constraint or index to apply by hand; the 1-14 range is enforced in the API.

## References

- Prior dashboard plan: `context/archive/2026-10-27-workout-dashboard/plan-brief.md`
- PR rule: `context/changes/personal-record-flag/plan-brief.md`, `src/main/java/com/example/gymtrack/workout/PersonalRecordService.java:27-75`
- Chart pattern: `frontend/src/components/ProgressionChart.tsx`
- Existing stats service and tests: `src/main/java/com/example/gymtrack/workout/DashboardService.java:31-43`, `src/test/java/com/example/gymtrack/workout/DashboardControllerTest.java`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — windows and comparison

#### Automated

- [x] 1.1 Dashboard tests pass, old and new: `./mvnw test -Dtest=DashboardControllerTest` — 4b78da5
- [x] 1.2 Full backend suite passes: `./mvnw test` — 4b78da5

#### Manual

- [x] 1.3 Against the local API, `days=all` returns `previous: null` and `days=7` returns a `previous` object — 4b78da5

### Phase 2: Backend — insights and weekly goal

#### Automated

- [x] 2.1 Migration applies and Hibernate validate passes: `./mvnw test -Dtest=DashboardInsightsControllerTest` — 2e91c41
- [x] 2.2 Full backend suite passes: `./mvnw test` — 2e91c41

#### Manual

- [x] 2.3 PUT weekly goal then GET insights on the local API shows the goal, 12 weekly items and plausible PRs — 2e91c41

### Phase 3: Frontend — dashboard UI

#### Automated

- [x] 3.1 Lint passes: `cd frontend && npm run lint` — 3f98e43
- [x] 3.2 Type check and production build pass: `cd frontend && npm run build` — 3f98e43

#### Manual

- [x] 3.3 Toggling 7 / 30 / 90 / All updates tiles; deltas show on the first three and are hidden on All — 3f98e43
- [x] 3.4 Weekly chart shows 12 bars and matches the tiles for the last 7 days — 3f98e43
- [x] 3.5 Recent PRs matches the PR badges in History for the same workouts — 3f98e43
- [x] 3.6 Setting a goal updates streak and "X of goal" immediately; clearing it shows the prompt — 3f98e43
- [x] 3.7 New user sees sensible empty states and the layout holds at phone width — 3f98e43
