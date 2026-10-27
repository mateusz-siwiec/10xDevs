# Workout Dashboard — Plan Brief

> Full plan: `context/changes/workout-dashboard/plan.md`
> Frame brief: `context/changes/workout-dashboard/frame.md`

## What & Why

> **Rzeczywisty problem, wokół którego należy planować, to**: użytkownik nie ma widoku zagregowanych postępów (liczba treningów, czas, wolumen w okresie), a decyzja o miejscu tego widoku względem obecnego `/` jest otwarta.

We add a dashboard showing completed workouts, time spent and total volume (Σ reps × kg) over the last 7 or 30 days, and make it the post-login screen.

## Starting Point

All needed data already exists (session start/end times, sets with reps and weight), but nothing aggregates it per user or period. `/` is today the workout screen, which is also where login lands.

## Desired End State

After login the user sees three totals for a selectable 7/30-day window and a button into training. New users see zeros and a prompt to log a first workout.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem framing | Confirmed: add a dashboard | Data suffices; no existing view covers per-user aggregates | Frame |
| Route | Dashboard on `/`, workout moves to `/workout` | Literal "screen after login"; login already navigates to `/` | Plan |
| Period | Rolling last 7 / 30 days | Avoids timezone and week-start ambiguity | Plan |
| Active session | Excluded from all metrics | Consistent numbers; abandoned sessions can't inflate time | Plan |
| Window anchor | Sessions that ended within the window | One session set drives count, time and volume | Plan |
| Data model | No migration; aggregate on read | Small data; avoids denormalised totals | Plan |
| Scope | Three numbers only, no charts/comparison | Keeps the slice small | Plan |

## Scope

**In scope:** stats endpoint, DashboardPage, route move, Topbar link, tests.

**Out of scope:** charts, period comparison, PRs, muscle-group breakdown, active-session banner, calendar weeks/timezones.

## Architecture / Approach

`GET /api/dashboard/stats?days=7|30` loads the user's sessions ended since `now − days`, sums durations in Java, and sums `reps × weightKg` with one JPQL query. The SPA fetches it via `authFetch` and renders tiles.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend stats endpoint | Endpoint + integration tests | Window boundary and active-session exclusion in tests |
| 2. Frontend page + routing | DashboardPage at `/`, `/workout`, Topbar | Stale links to `/` expecting the workout screen |

**Prerequisites:** none (auth and workout logging are done).
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Not in the PRD or roadmap M-1; the roadmap needs a new slice entry or an explicit decision to treat it as out-of-milestone.
- Abandoned (never ended) sessions are invisible to the dashboard by design.
- Assumes small per-user data; Java-side duration sum may move to SQL later.

## Success Criteria (Summary)

- Post-login screen shows correct count, time and volume for 7/30 days.
- Running sessions and other users' data never affect the numbers.
- Workout flow still works from `/workout`.
