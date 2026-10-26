# Core Workout Logging Loop — Plan Brief

> Full plan: `context/changes/core-workout-logging-loop/plan.md`
> Research: `context/changes/core-workout-logging-loop/research.md`

## What & Why

Build roadmap slice S-01: a logged-in user starts a workout, logs sets (reps + kg) for seeded exercises, ends the workout, and sees a progression chart for each exercise update immediately. It proves GymTrack's core hypothesis and creates the per-set history that S-03, S-08 and S-09 will read.

## Starting Point

Auth (F-01) and the seeded exercise catalog (F-02) are done. There is no session/set code in the backend and the frontend dashboard is a placeholder; no chart library is installed. Production runs Flyway off with `ddl-auto=update`.

## Desired End State

From the web app on a phone-sized screen, a user can start a workout, pick an exercise, log sets, delete a mistaken set after a confirmation, end the workout, and watch a line chart of top weight per session. The first set already shows a valid one-point chart; reloading mid-workout resumes the session; other users' data is invisible.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Set as source of truth | One row per set, linked to its session; chart is a query | Keeps per-set history for S-03/S-08/S-09 | Research / Plan |
| Active sessions | One per user; start is idempotent; DB partial unique index backs it | Avoids duplicate/ghost workouts that would skew "last N workouts" | Plan |
| Chart metric | Top weight per session, x = session start | Shows "lifting heavier", simplest valid single-point case | Plan |
| Weight | kg, decimal, 0.5 kg step, 0 < w ≤ 1000; reps 1–100 | Supports real plate increments without unit conversion | Plan |
| Correction | Delete set with confirm; no edit | Fixes typos and meets the destructive-action NFR without silent overwrite | Plan |
| Chart tech/update | Recharts; refetch progression after each change | Little code, one read-side source of truth | Plan |
| Cross-user access | Owner-scoped queries; foreign ids return 404 | Meets the "never visible to another user" guardrail | Research / Plan |
| Production | Not deployed; V4 constraints exist only where Flyway runs | Flyway-in-prod is a separate pending decision | Research |

## Scope

**In scope:** V4 schema, sessions/sets API, progression endpoint, workout page, exercise picker, set logger, delete-with-confirm, Recharts chart, backend integration tests.

**Out of scope:** set edit, plans, recommendations, PR flag, rest timer/navigation, volume chart/toggle, session history, auto-close, lb units, global 401 handling, frontend test runner, production rollout.

## Architecture / Approach

New `workout` package: entities `WorkoutSession`/`WorkoutSet`, a transactional `WorkoutService` holding ownership and lifecycle rules, thin controllers and a `{"error"}` exception handler. Progression is a grouped `max(weight)` query per session. The SPA adds typed client functions over `authFetch`, a `WorkoutPage` replacing the dashboard, and a `ProgressionChart` refetched after each log/delete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | V4 migration, entities, repos, schema test | Hibernate `validate` mismatch with SQL |
| 2. Session and set API | Start/current/end, log/delete set, isolation tests | Start race and ownership leaks |
| 3. Progression endpoint | Top weight per session series | Metric edge cases (active session, deletes) |
| 4. Frontend workout flow | Working logging UI replacing placeholder | Mobile usability, state after reload |
| 5. Frontend progression chart | Recharts chart with single-point/empty states | Library compatibility with React 19, chart staleness |

**Prerequisites:** F-01 and F-02 done (they are); local Postgres via `podman-compose up -d`; Docker for Testcontainers.
**Estimated effort:** ~3–5 sessions across 5 phases.

## Open Risks & Assumptions

- Recharts compatibility with React 19.2 is assumed, not yet verified; fallback is a small hand-rolled SVG chart.
- Production DB won't have V4's constraints until Flyway is enabled there.
- Abandoned sessions stay active until the user ends them (accepted trade-off of the one-active-session rule).
- An expired token mid-workout shows an error rather than redirecting (existing gap).

## Success Criteria (Summary)

- A user completes start → log set → see chart point → end, with the first set rendering a valid one-point chart and no reload.
- No cross-user visibility, proven by integration tests.
- A logged set persists immediately and survives reload.
