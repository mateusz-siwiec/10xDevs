# Personal Record Flag — Plan Brief

> Full plan: `context/changes/personal-record-flag/plan.md`

## What & Why

Flag a logged set as a new personal record when its estimated one-rep max (1RM) beats everything the user lifted before for that exercise, and show a "PR" badge on it. This is PRD FR-014 (nice-to-have, roadmap S-08) and adds a motivating, transparent signal on top of the logging loop.

## Starting Point

Sets are plain rows (`reps`, `weightKg`, `loggedAt`) and the set responses carry no derived data. A comparable read-only rule already exists (`ProgressionRecommendationService`), and the UI shows sets in the live session list and the history detail.

## Desired End State

While logging, a set that beats the user's best estimated 1RM for that exercise shows a "PR" badge immediately; the same badge appears when reviewing that workout later in History. Deleting a set during a workout corrects the badges of the remaining sets.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Baseline | Any earlier eligible set of that exercise (this and past sessions); the first-ever set is never flagged | Matches "beats the user's estimated 1RM" and avoids a badge on every new exercise. |
| High reps | Sets above 12 reps are ignored (never flagged, never a baseline) | The PRD notes the estimate is only reliable at lower reps. |
| Ties | Strictly greater is a record; equal is not | "Beats" read literally. |
| Formula | Epley, compared as `weight × (30 + reps)` | Exact `BigDecimal` comparison with no division or rounding. |
| Storage | Derived on read, no column or migration | Stays correct when sets are deleted, and production skips Flyway. |
| Display | Live session list and history detail | Shows the record when it happens and when reviewing it later. |

## Scope

**In scope:**
- `personalRecord` boolean on set responses (log, current, end, history detail)
- `PersonalRecordService` and a grouped baseline query
- "PR" badge in `SessionSetList` and `HistoryDetailPage`; refetch after delete
- Backend integration tests

**Out of scope:**
- Stored flags, migrations, records page, celebration/toast
- Other 1RM formulas or a configurable cutoff
- Flags on previous-workout hints, charts, dashboard or history list

## Architecture / Approach

One service decides which of a session's sets are records: it loads each exercise's best earlier score with a single grouped query (cutoff = session start), then walks the session's sets in logged order keeping a running best. Every response that lists a session's sets calls it, so the live and history views cannot disagree. The frontend renders the field and reloads the session after a delete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend — PR rule and API | Rule, baseline query, `personalRecord` on set payloads, integration tests | JPQL `max(weight * (30 + reps))` typing under this Hibernate version |
| 2. Frontend — PR badge | Types, badge in live and history views, refetch after delete | Stale badges if the delete refetch is missed |

**Prerequisites:** S-01 done (it is). No schema work, no new dependencies.
**Estimated effort:** ~1-2 sessions across 2 phases.

## Open Risks & Assumptions

- 1RM estimates are inaccurate at high reps; the 12-rep cutoff is a judgement call and is documented as a heuristic.
- Deleting an early set can retroactively change later flags (by design, since the flag is derived).
- Assumes one active session per user, so earlier sets always have `loggedAt` before the current session's start.

## Success Criteria (Summary)

- Logging a set that beats the user's earlier best shows "PR" immediately; ties, first sets and high-rep sets do not.
- The same workout shows the same badges in History.
- Backend suite, lint and build pass.
