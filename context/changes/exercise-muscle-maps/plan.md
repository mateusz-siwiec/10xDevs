# Muscle maps and finer back muscle groups Implementation Plan

## Overview

Show which muscles an exercise works as a small front + back body figure inside the existing technique tooltip panel, with primary muscles in a strong colour and secondary muscles in a lighter one. To make the figure detailed, the stored muscle groups are refined: `BACK` is split into `LATS`, `TRAPS` and `LOWER_BACK`, `CORE` is split into `ABS` and `OBLIQUES`, and `FOREARMS` is added (10 groups become 14). A new Flyway migration `V10` remaps the seeded exercises by slug and existing custom exercises; the figure is then driven entirely by the `primaryMuscleGroup` / `secondaryMuscleGroups` the API already returns.

## Current State Analysis

- `Exercise` (`frontend/src/api/client.ts:136-142`) carries `primaryMuscleGroup: string` and `secondaryMuscleGroups: string[]` for built-in and custom exercises. Built-ins are seeded in `src/main/resources/db/migration/V2__create_exercises_and_seed.sql`; `V3` removed hammer-curl's secondary BACK. Both columns are `varchar(32)`; the enum is `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java` (CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS, HAMSTRINGS, GLUTES, CALVES, CORE).
- Built-ins that use BACK today: primary on deadlift, pull-up, barbell-row, lat-pulldown; secondary on face-pull, romanian-deadlift, good-morning, hanging-leg-raise. Built-ins that use CORE: primary on plank, hanging-leg-raise, cable-crunch, ab-wheel-rollout; secondary on push-up, back-squat, front-squat.
- Group-driven behaviour: the exercise list filter and substitutes are by primary group (`ExerciseRepository.java:15-42`, `ExerciseService.java:41`); the stats chart counts sets per primary group in enum order (`DashboardService.java:171-183`); the create/edit form and the list filter iterate `MUSCLE_GROUPS` (`frontend/src/utils/muscleGroups.ts`, `ExerciseFormPage.tsx:144,154`, `ExercisesPage.tsx:128`). Labels live in `muscle.<GROUP>` in `en.json` / `pl.json`.
- Tests that reference BACK or the group list: `ExerciseSeedTest.java` (`everyMuscleGroupHasAtLeastThreePrimaryExercises`, line 40-48), `MuscleGroupStatsControllerTest.java:132-138`, `CustomExerciseControllerTest.java` (lines 171, 287-304), `ExerciseControllerTest.java:139`, and e2e `muscle-group-stats.spec.ts:8`, `workout-ui.spec.ts:28`.
- `TechniqueTooltip.tsx` (from the in-progress `exercise-technique-tooltips` change) takes `{ slug, name }` and renders nothing without cues; it is used in `ExercisesPage.tsx:169`, `SubstituteSuggestions.tsx:74` and `WorkoutPage.tsx:318`, which already hold full `Exercise` objects. `e2e/technique-tooltip.spec.ts` asserts no trigger for a custom exercise.
- Flyway owns the schema everywhere, including production (Supabase) on every deploy; applied migrations are never edited and the next free number is V10 (CLAUDE.md).
- UI rules (CLAUDE.md): tokens only, shared classes in `styles/page.css`, hover/focus-visible/disabled on interactive controls, `npm run check:tokens` scans the explicit file list in `frontend/scripts/check-hardcoded-values.mjs`.

## Desired End State

The 14 muscle groups are available in the API, the form, the list filter and the stats chart. Seeded exercises carry the remapped groups (e.g. Barbell Row: primary lats, secondary traps/biceps/forearms). Opening the info button of any exercise in the exercises list, the workout picker area or the substitutes panel shows the front and back figure with primary and secondary regions highlighted plus a legend in the active language; built-ins keep their cues below the map, custom exercises show the map only. Verified by backend and frontend unit tests, Playwright specs, lint, build and `check:tokens`.

### Key Discoveries:

- The group columns are plain `varchar(32)`, so the remap is straightforward SQL; the risk is the production deploy, not the schema (`V2__create_exercises_and_seed.sql:3-11`).
- `ExerciseSeedTest.everyMuscleGroupHasAtLeastThreePrimaryExercises` would fail for LOWER_BACK (1 primary), TRAPS (0) and FOREARMS (0); decided to exempt them and add catalog exercises in a separate change.
- Deadlift becomes primary LOWER_BACK, and nothing else is primary LOWER_BACK, so the substitutes panel will be empty for it (accepted: finer behaviour).
- The stats chart gains bars and substitutes narrow to the finer group (accepted: finer behaviour, no roll-up to the old BACK level).
- Existing custom exercises cannot be inspected from migrations; their BACK values default to LATS.

## What We're NOT Doing

- Splitting SHOULDERS (front/side/rear); it stays a single group.
- Adding new built-in exercises (shrugs, back extension, wrist curls); a follow-up change can fill the new groups.
- A roll-up from fine groups to a coarse "back" for substitutes or stats.
- Guessing custom exercises' new groups from their names.
- Per-exercise image files, GIFs/video, an imported anatomy SVG, list-row thumbnails, or a second info button.
- New Playwright visual-regression baselines.
- A down migration (Flyway Community has none; rollback is a restore or a forward fix).

## Implementation Approach

Data first: land the migration, enum and backend tests so every later layer sees the final 14 groups. Then align the frontend group list, labels, form and existing e2e. Then build the figure as a standalone data-driven component (regions tagged `data-muscle` / `data-state`, filled from tokens) whose region coverage is unit-tested, put it into the tooltip, and finish with Playwright and the verification sweep.

## Critical Implementation Details

- **State sequencing** — V10 must update primaries before replacing secondaries, and secondary inserts must use `on conflict do nothing` because `exercise_secondary_muscle_groups` has primary key `(exercise_id, muscle_group)`. Remap built-ins by slug first, then sweep remaining `BACK` values (custom exercises) to `LATS`. Never edit `V2`/`V3`.
- **Timing & lifecycle** — Deploy the backend (which runs V10) and then the frontend right after: an old frontend still sending `BACK` is rejected by the new enum with a 400 until it is replaced.

## Phase 1: Data and backend

### Overview

Introduce the finer groups in the database and the API and keep the backend test suite green.

### Changes Required:

#### 1. Migration V10

**File**: `src/main/resources/db/migration/V10__refine_muscle_groups.sql` (new)

**Intent**: Remap stored muscle groups to the finer set without touching applied migrations.

**Contract**: Built-in primary: `deadlift` → `LOWER_BACK`; `pull-up`, `barbell-row`, `lat-pulldown` → `LATS`. Built-in secondary BACK rows replaced by slug: `face-pull` → `TRAPS`; `romanian-deadlift`, `good-morning` → `LOWER_BACK`; (`hanging-leg-raise` loses BACK and keeps only FOREARMS). New secondaries (`on conflict do nothing`): `barbell-row` TRAPS + FOREARMS; `pull-up` FOREARMS; `deadlift` TRAPS + FOREARMS; `hanging-leg-raise` FOREARMS; `hammer-curl` FOREARMS; `plank` and `ab-wheel-rollout` OBLIQUES. Afterwards every remaining `BACK` (primary or secondary, i.e. custom exercises) becomes `LATS`. CORE is split too: every primary or secondary `CORE` (built-in and custom) becomes `ABS`; OBLIQUES exists only where listed above. Resulting invariant: no stored `BACK` or `CORE`, and no exercise lists its primary group as secondary.

#### 2. MuscleGroup enum

**File**: `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`

**Intent**: Replace `BACK` with the finer values and add `FOREARMS`.

**Contract**: Values in this order: CHEST, LATS, TRAPS, LOWER_BACK, SHOULDERS, BICEPS, TRICEPS, FOREARMS, QUADS, HAMSTRINGS, GLUTES, CALVES, ABS, OBLIQUES (the stats chart lists groups in enum order). Verify the JPA mapping stores the name as a string (the columns and `ExerciseSeedTest` assume so).

#### 3. Backend tests

**Files**: `src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java`, `.../workout/MuscleGroupStatsControllerTest.java`, `.../exercise/CustomExerciseControllerTest.java`, `.../exercise/ExerciseControllerTest.java`

**Intent**: Follow the new groups and lock the remap.

**Contract**: `everyMuscleGroupHasAtLeastThreePrimaryExercises` requires 3 only for groups that already had 3 before V10 (all except LOWER_BACK, TRAPS, FOREARMS, OBLIQUES) and states why. New seed test asserting the remap table above for the named slugs and that neither `BACK` nor `CORE` remains. Replace `BACK` with `LATS` and `CORE` with `ABS` in the stats, custom-exercise and filter tests.

#### 4. Migration notes in CLAUDE.md

**File**: `CLAUDE.md`

**Intent**: Keep the "next migration" pointer correct.

**Contract**: change "next is V10" to "next is V11".

### Success Criteria:

#### Automated Verification:

- Backend tests pass, including Flyway applying V10 on a clean database: `./mvnw test`
- Seed and stats tests pass: `./mvnw test -Dtest=ExerciseSeedTest,MuscleGroupStatsControllerTest`

#### Manual Verification:

- On a local database at V9 with a custom exercise using BACK as primary and another as secondary, applying V10 turns both into LATS and leaves other groups untouched
- The remap table in the plan matches the seeded rows after V10 (spot-check deadlift, barbell-row, face-pull)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend groups

### Overview

Make the SPA understand the 14 groups: constants, labels in both languages, the form, the filter and the specs that referenced BACK.

### Changes Required:

#### 1. Group constants and labels

**Files**: `frontend/src/utils/muscleGroups.ts`, `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Replace `BACK` and add `FOREARMS` everywhere groups are enumerated or labelled.

**Contract**: `MUSCLE_GROUPS` matches the backend enum values and order. `muscle.<GROUP>` exists in both locales for all 14 (en: Lats, Traps, Lower back, Forearms, Abs, Obliques; pl: Najszersze grzbietu, Kaptury, Dolny odcinek pleców, Przedramiona, Brzuch, Mięśnie skośne); `muscle.BACK` and `muscle.CORE` removed. Add a unit test asserting every `MUSCLE_GROUPS` value has a label in en and pl.

#### 2. Form, filter and stats page

**Files**: `frontend/src/pages/ExerciseFormPage.tsx`, `frontend/src/pages/ExercisesPage.tsx`, `frontend/src/pages/MuscleGroupStatsPage.tsx`

**Intent**: Confirm they follow the constants and labels with no hard-coded BACK.

**Contract**: expected to need no edit beyond the constants; touch a file only if the type change or a layout check (14 chart bars, 14 filter options) requires it.

#### 3. Existing e2e specs

**Files**: `frontend/e2e/muscle-group-stats.spec.ts`, `frontend/e2e/workout-ui.spec.ts`

**Intent**: Replace `BACK` with `LATS`.

**Contract**: `muscle-group-stats.spec.ts:8` uses `exerciseIdByGroup(..., 'LATS')`; `workout-ui.spec.ts:28` uses `['CHEST', 'LATS', 'QUADS']`. The workout visual baseline must stay unchanged (the first LATS exercise by name is still Barbell Row); do not refresh baselines.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (from `frontend/`)
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values: `npm run check:tokens`
- Updated specs pass (Postgres running): `npx playwright test e2e/muscle-group-stats.spec.ts e2e/exercises-list.spec.ts e2e/workout-ui.spec.ts`

#### Manual Verification:

- The create form offers all 14 groups and a custom exercise can be saved with TRAPS or FOREARMS
- The list filter shows 14 groups and Lats lists Barbell Row, Lat Pulldown and Pull-Up
- The stats page shows 14 bars in both languages without layout problems

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Muscle map component and tokens

### Overview

A self-contained `MuscleMap` SVG (front and back silhouettes) with one or more regions per muscle group, the colour tokens for both themes, styling, strings and unit tests.

### Changes Required:

#### 1. Colour tokens

**File**: `frontend/src/index.css`

**Intent**: Semantic tokens for primary, secondary and idle fills so no view uses literal colours.

**Contract**: `--muscle-primary`, `--muscle-secondary`, `--muscle-idle` in `:root` and overridden in the dark block where the value differs; prefer aliasing existing tokens (`var(--accent)`, `var(--accent-border)`, `var(--code-bg)`). Record them in `context/changes/dashboard-ui-contract/tokens.md`.

#### 2. MuscleMap component

**File**: `frontend/src/components/MuscleMap.tsx` (new)

**Intent**: Render two side-by-side figures where each region is highlighted from the exercise data, with an accessible name and a legend.

**Contract**: `MuscleMap({ primary: string; secondary: string[] })`. Region table (exported so tests can iterate it): front view — CHEST, SHOULDERS, BICEPS, FOREARMS, ABS, OBLIQUES, QUADS, CALVES; back view — TRAPS, SHOULDERS (rear), LATS, LOWER_BACK, TRICEPS, FOREARMS, GLUTES, HAMSTRINGS, CALVES. A group drawn in both views is highlighted in both. Each region has `data-muscle="<GROUP>"` and `data-state="primary|secondary|idle"`; primary wins if a group is in both inputs; unknown strings are ignored. The `<svg>` has `role="img"` and an `aria-label` built from `muscleGroupLabel()`. The legend has two swatches labelled from locale keys.

#### 3. Styling

**File**: `frontend/src/styles/page.css`

**Intent**: Shared classes next to the `.technique-*` block, fills driven by `data-state` and the tokens.

**Contract**: `.muscle-map`, `.muscle-map-figures`, `.muscle-region[data-state=...]`, `.muscle-legend`, `.muscle-swatch--primary|--secondary`; figures sized in `rem` to fit `.technique-panel`'s `max-width: min(20rem, calc(100vw - 2rem))`. No interactive controls, so no hover/focus states.

#### 4. Locale strings

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Text for the map section.

**Contract**: under `exercises`: `musclesHeading`, `musclePrimary`, `muscleSecondary`, `musclesLabel` (`"Muscles worked: {{name}}"`), identical key sets in both files (the locales test enforces parity).

#### 5. Unit tests

**File**: `frontend/src/components/MuscleMap.test.tsx` (new)

**Intent**: Lock the data-to-regions mapping.

**Contract**: every `MUSCLE_GROUPS` value has at least one region; primary region is `primary`, secondary `secondary`, others `idle`; a group in both inputs renders `primary`; an unknown group string renders without error and highlights nothing; the `aria-label` contains translated names in en and pl.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values: `npm run check:tokens`

#### Manual Verification:

- The figure reads as a front and back body and all 14 groups are distinguishable
- Primary and secondary shades are distinguishable in light and dark themes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Tooltip integration

### Overview

Put `MuscleMap` at the top of the technique panel for every exercise and show a map-only tooltip for custom exercises.

### Changes Required:

#### 1. TechniqueTooltip

**File**: `frontend/src/components/TechniqueTooltip.tsx`

**Intent**: Render the map above the cues and stop returning `null` for exercises without cues.

**Contract**: prop type becomes `Pick<Exercise, 'slug' | 'name' | 'primaryMuscleGroup' | 'secondaryMuscleGroups'>`. Panel order: map section (heading `exercises.musclesHeading`, figure, legend), then the existing technique heading and list only when `exerciseTechnique()` returned cues. The trigger `aria-label` stays `exercises.techniqueLabel` ("How to do …") when cues exist and is `exercises.musclesLabel` when only the map exists. Open/close, hover/focus/touch, Escape and viewport-clamping logic stays untouched.

#### 2. Call sites and token guard

**Files**: `frontend/src/pages/ExercisesPage.tsx`, `frontend/src/components/SubstituteSuggestions.tsx`, `frontend/src/pages/WorkoutPage.tsx`, `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Pass the muscle fields through and keep the guard honest.

**Contract**: the three call sites already pass full `Exercise` objects, so expect no edit beyond type checking; confirm the list row layout from `fix/exercises-row-layout` still keeps Edit/Delete on the right now that custom rows get a trigger. Add `src/components/MuscleMap.tsx` to the scanned `FILES` list.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values (now scanning `MuscleMap.tsx`): `npm run check:tokens`

#### Manual Verification:

- List, workout picker area and substitutes panel show the map above the cues for a built-in (Barbell Row: lats strong; traps, biceps, forearms light)
- A custom exercise shows a trigger and a map-only panel in every place that lists it
- Switching language changes the legend, heading and aria-label
- The panel stays inside the viewport on a 390px-wide screen
- Dark theme looks right

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 5: Playwright and verification

### Overview

Update the e2e expectation that custom exercises have no trigger, add map specs, and run the full sweep.

### Changes Required:

#### 1. Existing spec update

**File**: `frontend/e2e/technique-tooltip.spec.ts`

**Intent**: Custom exercises now have a trigger (map only).

**Contract**: for a custom exercise the trigger exists with the name `Muscles worked: <name>` (not `How to do …`), its panel shows the map and no technique heading or list. Built-in assertions on `/^How to do/` remain.

#### 2. Muscle map specs

**File**: `frontend/e2e/muscle-map.spec.ts` (new)

**Intent**: Cover the behaviour end to end with the existing helpers (`registerViaApi`, `auth`, `exerciseId`).

**Contract**: (a) Barbell Row in the exercises list: `[data-muscle="LATS"][data-state="primary"]`, `[data-muscle="TRAPS"][data-state="secondary"]`, `[data-muscle="BICEPS"][data-state="secondary"]`, `[data-muscle="CHEST"][data-state="idle"]`; (b) a custom exercise created via API with primary TRICEPS and secondary FOREARMS shows those states and no cue list; (c) workout picker area and substitutes panel show the map for the selected or suggested exercise; (d) Polish language shows the Polish legend. No screenshot baselines.

### Success Criteria:

#### Automated Verification:

- Playwright specs pass (Postgres running, `CI` unset): `npm run test:e2e`
- Backend tests pass: `./mvnw test`
- Unit tests pass: `npm test`
- Build passes: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values: `npm run check:tokens`

#### Manual Verification:

- Hover, keyboard focus and tap still open and close the panel as before
- No visual regression in the exercises list row layout, workout screen or substitutes panel
- Deploy order confirmed: backend with V10 first, frontend right after; a Supabase backup or snapshot exists before the deploy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Backend: V10 remap by slug (primary and secondary), no `BACK` left, no exercise lists its primary as secondary, relaxed seed-count rule, stats and substitutes with the new groups.
- Frontend: every `MUSCLE_GROUPS` value has en/pl labels; `MuscleMap` region coverage, states, precedence, unknown group, accessible label.

### Integration Tests:

- Playwright: updated stats and workout specs, built-in map, custom map-only tooltip, workout picker and substitutes placements, Polish legend, updated custom-trigger expectation.

### Manual Testing Steps:

1. On a local database at V9 create custom exercises with BACK (primary and secondary), apply V10, and check they became LATS.
2. Open the exercises list, hover the info button on Barbell Row, check lats strong and traps/biceps/forearms light.
3. Create a custom exercise (primary TRICEPS) and confirm a map-only panel.
4. Start a workout, pick exercises and open "Find substitute"; check the map in each place and that Deadlift shows no substitutes.
5. Toggle language and dark theme; check a 390px viewport and the 14-bar stats page.

## Performance Considerations

The figure is a small inline SVG rendered only while the panel is open, so there is no list-wide cost. The migration touches about 50 seeded rows plus a user's custom exercises.

## Migration Notes

`V10` runs on the Supabase database at the next backend deploy and cannot be undone by Flyway; take a backup or snapshot first, and never point a local run at Supabase. Existing custom exercises with BACK become LATS and users can edit them. History and stats follow automatically because sets read the group from the exercise.

## References

- Prior change this builds on: `context/changes/exercise-technique-tooltips/plan.md`
- Muscle data: `frontend/src/api/client.ts:136-142`, `src/main/resources/db/migration/V2__create_exercises_and_seed.sql`, `src/main/resources/db/migration/V3__drop_hammer_curl_back_secondary.sql`, `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`
- Group-driven code: `ExerciseRepository.java`, `ExerciseService.java:41`, `DashboardService.java:171-183`, `frontend/src/utils/muscleGroups.ts`
- Tooltip component and styles: `frontend/src/components/TechniqueTooltip.tsx`, `frontend/src/styles/page.css` (`.technique-*`)
- Token guard: `frontend/scripts/check-hardcoded-values.mjs`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data and backend

#### Automated

- [x] 1.1 Backend tests pass, including Flyway applying V10 on a clean database: `./mvnw test` — 35d9a01
- [x] 1.2 Seed and stats tests pass: `./mvnw test -Dtest=ExerciseSeedTest,MuscleGroupStatsControllerTest` — 35d9a01

#### Manual

- [x] 1.3 On a local database at V9, custom exercises with BACK as primary and as secondary become LATS after V10 and other groups are untouched — 35d9a01
- [x] 1.4 The remap table matches the seeded rows after V10 (spot-check deadlift, barbell-row, face-pull) — 35d9a01

### Phase 2: Frontend groups

#### Automated

- [x] 2.1 Unit tests pass: `npm test`
- [x] 2.2 Type check and build pass: `npm run build`
- [x] 2.3 Lint passes: `npm run lint`
- [x] 2.4 No hard-coded values: `npm run check:tokens`
- [x] 2.5 Updated specs pass (Postgres running): `npx playwright test e2e/muscle-group-stats.spec.ts e2e/exercises-list.spec.ts e2e/workout-ui.spec.ts`

#### Manual

- [x] 2.6 The create form offers all 14 groups and a custom exercise can be saved with TRAPS or FOREARMS
- [x] 2.7 The list filter shows 14 groups and Lats lists Barbell Row, Lat Pulldown and Pull-Up
- [x] 2.8 The stats page shows 14 bars in both languages without layout problems

### Phase 3: Muscle map component and tokens

#### Automated

- [ ] 3.1 Unit tests pass: `npm test`
- [ ] 3.2 Type check and build pass: `npm run build`
- [ ] 3.3 Lint passes: `npm run lint`
- [ ] 3.4 No hard-coded values: `npm run check:tokens`

#### Manual

- [ ] 3.5 The figure reads as a front and back body and all 14 groups are distinguishable
- [ ] 3.6 Primary and secondary shades are distinguishable in light and dark themes

### Phase 4: Tooltip integration

#### Automated

- [ ] 4.1 Unit tests pass: `npm test`
- [ ] 4.2 Type check and build pass: `npm run build`
- [ ] 4.3 Lint passes: `npm run lint`
- [ ] 4.4 No hard-coded values (now scanning `MuscleMap.tsx`): `npm run check:tokens`

#### Manual

- [ ] 4.5 List, workout picker area and substitutes panel show the map above the cues for a built-in exercise
- [ ] 4.6 A custom exercise shows a trigger and a map-only panel in every place that lists it
- [ ] 4.7 Switching language changes the legend, heading and aria-label
- [ ] 4.8 The panel stays inside the viewport on a 390px-wide screen
- [ ] 4.9 Dark theme looks right

### Phase 5: Playwright and verification

#### Automated

- [ ] 5.1 Playwright specs pass (Postgres running, `CI` unset): `npm run test:e2e`
- [ ] 5.2 Backend tests pass: `./mvnw test`
- [ ] 5.3 Unit tests pass: `npm test`
- [ ] 5.4 Build passes: `npm run build`
- [ ] 5.5 Lint passes: `npm run lint`
- [ ] 5.6 No hard-coded values: `npm run check:tokens`

#### Manual

- [ ] 5.7 Hover, keyboard focus and tap still open and close the panel as before
- [ ] 5.8 No visual regression in the exercises list row layout, workout screen or substitutes panel
- [ ] 5.9 Deploy order confirmed (backend with V10 first, then frontend) and a Supabase backup or snapshot exists before the deploy
