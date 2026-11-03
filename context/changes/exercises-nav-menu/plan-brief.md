# Unified exercises list — Plan Brief

> Full plan: `context/changes/exercises-nav-menu/plan.md`
> Note: the id comes from the original idea (a top-bar dropdown); the design changed to one filtered list.

## What & Why

Make it easy to browse exercises, including for people who don't know them. One list shows every exercise with its muscles, filterable by All / Mine and by muscle group, instead of a page that shows only your custom exercises.

## Starting Point

The "Exercises" nav link opens `MyExercisesPage`, which mixes a create/edit form with a list of custom exercises only. The built-in exercises can't be browsed outside the pickers. `GET /api/exercises` already returns everything.

## Desired End State

`/exercises` lists built-in and custom exercises (custom tagged), with All / Mine and muscle filters and an "Add exercise" button. Custom rows can be edited or deleted. Add and edit use their own form page and return to the list.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Navigation | Keep plain "Exercises" link; no dropdown | One filtered list makes a three-entry menu redundant. |
| List content | All exercises, All / Mine + muscle filters | Lets users find exercises by muscle and manage their own in one place. |
| Routes | `/exercises`, `/exercises/new`, `/exercises/:id/edit` | Form gets its own URL so the list stays simple. |
| Old URL | `/exercises` now shows the full list | Clean URLs with no redirects. |
| Backend | No changes | Existing endpoints cover list, create, update, delete. |

## Scope

**In scope:** unified list page with filters, form page and routes, strings (EN/PL), e2e spec, keeping existing specs green.

**Out of scope:** top-bar dropdown, mobile drawer group, backend changes, name search, editing built-in exercises.

## Architecture / Approach

Reuse `MyExercisesPage` as the list (remove its form), extract the form into `ExerciseFormPage`, and filter client-side from the full `getExercises()` result.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Unified list page | Filtered list with Custom tag and actions | New controls need all states and token-only styling |
| 2. Form page | `/exercises/new` and `/:id/edit` returning to the list | Edit must handle missing or built-in ids |
| 3. Tests and strings | EN/PL keys, new e2e, existing specs still green | Locale key parity |

**Prerequisites:** Postgres running for e2e.
**Estimated effort:** ~2 sessions across 3 small phases.

## Open Risks & Assumptions

- The full exercise list stays small enough to filter in memory.
- Existing bookmarks of `/exercises` land on the new list rather than only custom exercises.

## Success Criteria (Summary)

- All exercises are browsable and filterable; own exercises can be added, edited and deleted.
- Build, lint, token guard, unit and e2e checks pass.
