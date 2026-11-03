# Muscle maps and finer back muscle groups — Plan Brief

> Full plan: `context/changes/exercise-muscle-maps/plan.md`

## What & Why

Users should see which muscles an exercise works. Each exercise's info panel gets a front and back body figure with primary muscles in a strong colour and secondary muscles lighter. To make the figure useful, `BACK` is split into lats, traps and lower back and forearms are added, so a barbell row highlights lats and traps instead of the whole back.

## Starting Point

Every exercise already has `primaryMuscleGroup` and `secondaryMuscleGroups` in the API, but only 10 coarse groups, and `BACK` is a single value. `TechniqueTooltip` already appears in the exercises list, workout picker area and substitutes panel, but it only knows the exercise name and slug and renders nothing without technique cues. The exercise filter, substitutes and the stats chart are all driven by the primary group.

## Desired End State

14 muscle groups across the API, form, filter and stats chart. Opening the info button on any exercise shows the map at the top of the panel with a legend in the active language; built-ins keep their cues below it, custom exercises show the map only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Detail level | Split BACK into LATS/TRAPS/LOWER_BACK and CORE into ABS/OBLIQUES, add FOREARMS in the data (14 groups) | One source of truth, so built-in and custom exercises are equally detailed | Plan |
| Group left coarse | SHOULDERS | Keeps the migration and figure manageable | Plan |
| Built-in remap | By slug in V10 (deadlift → LOWER_BACK; pull-up, row, pulldown → LATS; BACK secondaries → TRAPS/LOWER_BACK; CORE → ABS with OBLIQUES added to plank and ab wheel; forearms added where grip matters; hanging-leg-raise keeps only FOREARMS) | Deterministic and reviewable in the PR | Plan |
| Custom exercises with BACK or CORE | BACK defaults to LATS, CORE to ABS | One simple rule; users can edit afterwards | Plan |
| Substitutes and stats | Accept finer behaviour, no roll-up | No extra code and more precise results | Plan |
| Seed rule | Exempt LOWER_BACK, TRAPS, FOREARMS, OBLIQUES from the "3 primary exercises" test; new exercises later | Keeps this change free of new catalog content | Plan |
| Placement | Inside the existing tooltip panel | Reuses open/close behaviour and all three placements | Plan |
| Shading | Primary strong, secondary light, with legend | Uses data we already have and shows secondary muscles | Plan |
| Figure source | Hand-drawn SVG, front + back | No licence risk, tiny, styled with tokens | Plan |
| Custom tooltip | Map-only, trigger label "Muscles worked: …" | Custom exercises have muscle data; the label must not claim "How to do" | Plan |
| Tests | Backend and unit tests, Playwright, no new screenshot baselines | Guards the remap and real screens without platform-specific baselines | Plan |

## Scope

**In scope:** V10 migration, `MuscleGroup` enum, backend tests, frontend group constants and labels, form/filter/stats alignment, `MuscleMap` component, colour tokens, tooltip integration, Playwright specs, `check:tokens` coverage.

**Out of scope:** splitting shoulders or core, new built-in exercises, roll-up to a coarse "back", name-based guessing for custom exercises, images/GIFs/video, imported anatomy SVG, list thumbnails, visual baselines, a down migration.

## Architecture / Approach

Land the data change first (migration, enum, backend tests), then align the frontend to 14 groups, then build a data-driven `MuscleMap` component that tags SVG regions with `data-muscle` and `data-state` and fills them from tokens, then render it in the tooltip, and finish with Playwright and the full sweep.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and backend | V10 remap (BACK and CORE splits), new enum, updated backend tests | Production migration; custom BACK defaults to LATS |
| 2. Frontend groups | 14 groups in constants, labels (pl/en), form, filter, stats, e2e fixes | Stats chart and filter layout with 4 more groups |
| 3. Muscle map and tokens | `MuscleMap` SVG, tokens, CSS, unit tests | A hand-drawn figure that is hard to read at small size |
| 4. Tooltip integration | Map in the panel, map-only for custom exercises | Panel overflow on 390px screens; row layout with new triggers |
| 5. Playwright and verification | Updated and new specs, full sweep, deploy checks | Old spec asserted "no trigger for custom" |

**Prerequisites:** `exercise-technique-tooltips` (in progress, uncommitted `TechniqueTooltip.tsx` on `fix/exercises-row-layout`) should be committed first; local Postgres for backend and e2e tests; a Supabase backup before deploy.
**Estimated effort:** ~3-4 sessions across 5 phases.

## Open Risks & Assumptions

- V10 runs on production at deploy and Flyway cannot undo it; a backup is the rollback. Deploy backend then frontend right after, because an old frontend sending `BACK` gets a 400.
- Deadlift becomes primary LOWER_BACK with no built-in substitutes; the Traps, Forearms and Obliques filters show no built-in results until a follow-up adds exercises.
- Custom exercises that really were lower back or traps become LATS until edited; custom CORE exercises become ABS.
- Drawing a readable 14-group silhouette by hand is the main craft risk and may take a couple of iterations.
- Assumes all three tooltip call sites already pass full `Exercise` objects; confirmed from the code, to be confirmed by the type check.

## Success Criteria (Summary)

- Every exercise shows a correct, legible muscle map in the list, workout and substitutes panel, in light and dark themes and in Polish and English.
- Built-ins use the remapped finer groups; stats, filter and form support all 14; no `BACK` or `CORE` remains in stored data.
- Backend tests, unit tests, Playwright, lint, build and `check:tokens` all pass.
