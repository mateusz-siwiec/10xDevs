# Favourite exercises and text search — Plan Brief

> Full plan: `context/changes/favorite-exercises-search/plan.md`

## What & Why

Users can star exercises as favourites and search exercise lists by text. The catalog is long and the same few lifts are used every session, so favourites and search cut the time spent finding an exercise, both when browsing and when logging a workout.

## Starting Point

Catalog exercises are shared rows, so a per-user flag cannot live on them. The Exercises page already filters on the client (All/Mine plus a muscle dropdown). The picker used in the workout and plan editor screens is a plain native select. The backend favourites layer (migration V11, two endpoints, a `favorite` response flag, three tests) was drafted before planning and is not yet confirmed green.

## Desired End State

The Exercises page has a star on each row, a Favourites scope and a search box that combines with the existing filters. The picker has a search box and a Favourites group on top. Favourites are per user and persist. Search ignores case and diacritics, so `lawce` finds "Wyciskanie na ławce".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Surfaces | Exercises page and picker | Browsing and logging are both slow with a long list. | Plan |
| Storage | Per-user `favorite_exercises` table (V11) | Catalog rows are shared, so only a join table works for them and custom ones alike. | Plan |
| Picker search | Filter input above the native select | Keeps native select accessibility and mobile pickers with a small change. | Plan |
| Favourites placement | Star + Favourites scope on the page, Favourites group in the picker | Favourites help most while logging and are managed where exercises are listed. | Plan |
| Matching | Displayed name, case- and diacritics-insensitive (`ł` mapped explicitly) | Works for Polish typing without accents and for translated names. | Plan |
| API shape | Idempotent `PUT`/`DELETE /favorite`, flag on every response | Allows optimistic UI and rollback without duplicate-state bugs. | Plan |
| Picker details | Selected option always kept; starred item shown once | Filtering must not drop the user's selection or duplicate options. | Plan |

## Scope

**In scope:** migration, endpoints and tests; client API; shared search helper; EN/PL strings; star, Favourites scope and search on the Exercises page; search and Favourites group in the picker; unit and Playwright tests; doc updates (next migration V12).

**Out of scope:** server-side search, custom combobox, star inside the picker, muscle-group text matching, favourites on dashboard or plan entries, persisting search text, new screenshot baselines.

## Architecture / Approach

A new join table feeds a `favorite` boolean on each exercise response. The frontend adds one shared `matchesExerciseSearch` helper used by `ExercisesPage` (extended filter state) and `ExercisePicker` (local search state, optgroups). Toggling is optimistic and rolls back on error.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend favourites API | Verified V11, endpoints, authorization and cascade tests | Drafted code may hide failures not yet seen |
| 2. Frontend foundation | Typed API, search helper with unit tests, strings | `ł` and accent handling in the matcher |
| 3. Exercises page | Star, Favourites scope, search, e2e | Row layout on phones and focus after un-starring |
| 4. Exercise picker | Search box and Favourites group in workout and plan editor | Losing the selected exercise while filtering |

**Prerequisites:** Local Postgres running (`podman-compose up -d`) for backend and e2e tests.
**Estimated effort:** ~3-4 sessions across 4 phases.

## Open Risks & Assumptions

- The drafted backend's tests were not observed passing; Phase 1 starts by running them.
- No existing token suits the starred state; if none fits, one is added to `index.css` and `tokens.md`.
- The extra search field must not break the picker row on phones; a CSS tweak may be needed.

## Success Criteria (Summary)

- A user can star exercises, find them under Favourites, and see them first in the picker.
- Typing part of a name, with or without Polish diacritics, narrows both lists.
- Backend and full e2e suites pass with no baseline changes.
