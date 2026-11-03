# Save workout as plan — Plan Brief

> Full plan: `context/changes/save-workout-as-plan/plan.md`

## What & Why

Let users turn a completed workout into a reusable training plan in one step, instead of rebuilding it by hand in the plan editor.

## Starting Point

`POST /api/training-plans` and `createPlan` already exist; plan entries store only exercise, sets and reps. `HistoryDetailPage` shows finished workouts grouped by exercise, and `WorkoutPage` drops the session as soon as it is ended, with no summary screen.

## Desired End State

On a finished workout (history detail, or right after "End workout") the user clicks "Save as plan", confirms a prefilled editable name, and finds the new plan in `/plans` mirroring the workout's exercise order, set counts and typical reps.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Reps target | Most common rep count (tie → higher) | Matches a typical 3x10 plan and ignores a single odd set. |
| Plan name | Prefilled (source plan name or date), editable | One quick step and a meaningful name. |
| Entry points | History detail + post-End panel | Covers old workouts and the fresh-workout moment. |
| Edge cases | One entry per consecutive run, sets ≤ 20, first 50 entries | Never fails validation and keeps real order. |
| Backend | No changes | Existing endpoint already fits. |

## Scope

**In scope:** mapping util with tests, shared `SaveAsPlan` component, history detail wiring, post-End panel, i18n strings, e2e spec.

**Out of scope:** new endpoints/migrations, weights in plans, merging repeated exercises, editing before save, a full workout summary page.

## Architecture / Approach

Pure function `workoutToPlanEntries` feeds a shared `SaveAsPlan` component that calls `createPlan`. Both pages only supply the sets and a default name.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Mapping util | Tested set → plan entry conversion | Rule edge cases (ties, caps) |
| 2. Component + history | Inline form on history detail | Style/token and locale compliance |
| 3. Post-End panel + e2e | Panel after ending; e2e for both entry points | Capturing sets before session is cleared |

**Prerequisites:** Postgres running for e2e.
**Estimated effort:** ~2 sessions across 3 small phases.

## Open Risks & Assumptions

- Group order in history detail is assumed to equal workout order.
- Per-set weights and varied reps are intentionally lost in the plan.

## Success Criteria (Summary)

- Saving from either entry point produces a correct plan visible in `/plans`.
- Unit, build, lint, token guard and e2e checks pass.
