# Training History — Plan Brief

> Full plan: `context/changes/training-history/plan.md`

## What & Why

GymTrack gets a Training history page (roadmap S-13, anchor MS-03): a paginated list of all past workouts and a compact view of how one went, so users can look back beyond the dashboard's 7/30-day totals.

## Starting Point

Sessions and sets already hold everything needed (`startedAt`, `endedAt`, nullable `planId`, sets with reps and weight), and the dashboard already computes duration and volume. But no endpoint lists or fetches past sessions, and the repo has no paging convention yet.

## Desired End State

A "History" topbar link opens `/history`: ended workouts newest first, 20 per page with Prev / Next, filterable by plan ("All", each plan, "No plan"). Rows show date, plan, duration, sets and volume. A row opens `/history/:id` with the sets grouped per exercise in logged order.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Pagination | Page + size with total count, Prev / Next UI | Matches "paginated list" and lets users go back; fine at MVP data volume. |
| Row content | Date, plan, duration, sets, volume | Scannable and consistent with dashboard numbers. |
| Detail view | Separate page `/history/:id` | Linkable, back button works, natural home for S-14 editing later. |
| Filtering | By plan: All / each plan / No plan | Chosen by the user; every workout falls under exactly one choice. |
| Compact view | Sets per exercise in logged order | Shows how the workout went; same format as the S-12 hint. |
| Which sessions | Ended only | Running workouts live on the workout screen. |
| Aggregates | Page sessions first, then one grouped query for their ids | No N+1 and no `group by` + `Page` count pitfalls. |
| Filter params | Three repository methods, not nullable UUID parameters | Postgres cannot type-infer null UUID params in JPQL. |
| URL state | Page and filter in the query string | Back from a detail page restores the list position. |

## Scope

**In scope:** list and detail endpoints with tests, `/history` and `/history/:id` pages, topbar link, plan filter.

**Out of scope:** editing/adding workouts (S-14), date or exercise filters, sorting options, schema changes, per-exercise summaries, infinite scroll.

## Architecture / Approach

A read-only `HistoryService` pages the caller's ended sessions (filter by plan, no plan, or none), fetches set count and volume for just that page's ids in one grouped query and resolves plan names in one batch; a `HistoryController` serves list and detail, with invalid parameters mapped to 400. The SPA keeps page and filter in the URL, fetches with the cancelled-flag pattern and gets exercise names from the existing `getExercises()`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend history API | Tested paged/filtered list with aggregates + detail endpoint | Correct paging with aggregates; scoping to the caller's plans and sessions |
| 2. Frontend history list | `/history` page, filter, pager, topbar link | URL-driven state and stale responses |
| 3. Frontend compact view | `/history/:id` with grouped sets, linked from rows | Not-found and running-session handling |

**Prerequisites:** S-01 (done).
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- A session of a deleted plan has no plan name and shows under "No plan" (accepted; no snapshot).
- Offset paging can shift if a workout ends while browsing (accepted at this volume).
- Plan names shown are the current ones, so renamed plans change in old rows (accepted).

## Success Criteria (Summary)

- History lists only ended workouts, newest first, with correct per-row numbers and working Prev / Next.
- The plan filter, including "No plan", returns the right workouts and never another user's.
- A workout opens in a compact view with its sets per exercise; unknown or running ids show "not found".
