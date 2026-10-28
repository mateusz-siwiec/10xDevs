# Dashboard Insights — Plan Brief

> Full plan: `context/changes/dashboard-insights/plan.md`

## What & Why

Make the dashboard answer "am I progressing and staying consistent?" instead of only "what are my totals?". It adds a previous-period comparison on each tile, 90-day and All windows, a 12-week volume chart, the latest personal records, and a weekly streak with a goal the user sets.

## Starting Point

The dashboard shows workouts, time and volume for a rolling 7 or 30 days from one stats endpoint, with no baseline, history or goal. The PR rule exists only per session (`personal-record-flag`), `recharts` is already installed, and users have no settings.

## Desired End State

The user picks 7 / 30 / 90 / All and sees each tile with a percentage change against the previous equal window. Below sit a 12-week volume bar chart, the 5 most recent PRs, and a consistency block showing the streak and "X of goal this week" with an editable goal.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Week definition | Rolling 7-day blocks back from now | Same rule as the existing windows, so no timezone or week-start problem. |
| Streak | Consecutive weeks with workouts >= goal; current week never breaks it | One concept ties goal and streak together. |
| Goal storage | Nullable `weekly_goal` on users, set via PUT, range 1-14 | Follows the user across devices; production gets the column from `ddl-auto=update`. |
| Windows | 7 / 30 / 90 / All; chart fixed at 12 weeks | Trend needs history regardless of the toggle. |
| All-time deltas | Hidden | There is no honest previous period. |
| Recent PRs | Latest 5 over whole history, derived on read | Never empty for an active user and needs no new storage. |
| PR rule | Reuse `PersonalRecordService` eligibility and score across sessions | History and Dashboard cannot disagree. |
| API shape | Extend `/stats`; new `/insights` and `PUT /weekly-goal` | Toggle refetches only the cheap stats. |

## Scope

**In scope:**
- `days=90|all` and `previous` totals on stats
- `V9` migration, goal endpoint, `/api/dashboard/insights`
- Cross-session PR scan in `PersonalRecordService`
- Dashboard UI: toggle, deltas, chart, PR list, consistency block
- Backend integration tests

**Out of scope:**
- Calendar weeks, timezones, muscle balance, exercise progress charts, plan adherence
- Stored PR flags, records page, caching, SQL aggregation
- Any metric from the active session

## Architecture / Approach

Window math is one half-open range on `endedAt`, reused for current and previous windows. Insights is computed in Java from small per-user reads (ended sessions, eligible sets) into 12 week blocks, a streak and the PR list, then rendered by three new components next to the existing tiles. Insights load once; the toggle refetches stats only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend — windows and comparison | `days=90\|all`, `previous` totals, tests | Widening `days` to a string must keep the existing 400 cases |
| 2. Backend — insights and goal | Migration, goal PUT, insights with weekly volume, streak, PRs | PR scan drifting from the per-session rule; streak edge cases |
| 3. Frontend — dashboard UI | Toggle, deltas, chart, PR list, consistency block | Empty states and phone layout |

**Prerequisites:** `personal-record-flag` backend (committed). Land its uncommitted frontend work first, since both touch `client.ts`.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- The PR scan reads all eligible sets per insights load, which assumes small per-user histories.
- Rolling week bars do not align with Monday-Sunday; a user may expect calendar weeks.
- Changing the goal changes the streak value retroactively (derived on read).
- Deleting an old set can retroactively change which sets are records.

## Success Criteria (Summary)

- Tiles show correct deltas for 7/30/90 and none for All; windows and previous windows are exact at the boundaries.
- Weekly chart, streak and Recent PRs match the underlying workouts and History's PR badges.
- Setting or clearing the goal updates the streak immediately; backend suite, lint and build pass.
