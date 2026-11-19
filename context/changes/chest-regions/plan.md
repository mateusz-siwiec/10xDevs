# Upper, Mid and Lower Chest Implementation Plan

## Overview

Replace the single `CHEST` muscle group with `UPPER_CHEST`, `MID_CHEST` and `LOWER_CHEST` across the Spring Boot backend, the Postgres data, the SVG body figure, the React UI and the tests. The change copies the shape of the earlier shoulders split (V12): the enum holds only leaf groups, a Flyway migration rewrites the stored strings, and "Chest" survives only as a frontend parent row on the muscle stats page. Two new catalogue exercises (decline bench press, chest dip) make the lower chest usable out of the box.

## Current State Analysis

- **Enum:** `MuscleGroup` has 18 values and `CHEST` is first (`src/main/java/com/example/gymtrack/exercise/MuscleGroup.java:3-22`).
- **Persistence:** primary groups live in `exercises.primary_muscle_group`; secondary groups are rows in `exercise_secondary_muscle_groups` (`V2__create_exercises_and_seed.sql:5,8-12`). Both are `varchar(32)` with no CHECK constraint, so removing an enum value only fails at Java read time, and a data migration is mandatory.
- **Seed data:** four built-ins have a `CHEST` primary (`barbell-bench-press`, `incline-dumbbell-press`, `chest-fly`, `push-up`, `V2:15-18`); `close-grip-bench-press` has `CHEST` as a secondary (`V2:75`). The catalogue holds 48 built-ins (`ExerciseSeedTest.java:39-40`).
- **Precedent:** V12 (`V12__split_shoulders_add_adductors_abductors.sql`) re-tags built-ins by slug, inserts new catalogue rows with `owner_id` null, converts primaries before secondaries for custom exercises, then deletes the legacy secondary rows. `SplitShouldersMigrationTest` is the Testcontainers pattern for such a migration.
- **Dashboard:** stats rows are generated from `MuscleGroup.values()` (`DashboardService.java:183`), so new values get a zero row automatically. Counting uses the primary group only (`WorkoutSetRepository.java:40-49`).
- **Figure:** `muscleFigureData.ts` holds a flat `muscles` array per view, with two `CHEST` paths in the front view (one per side) and none in the back view. There is no generator script in the repo; the data came from a throwaway text-parse of `@musclemap/assets` 1.1.0 (`context/changes/precise-muscle-figure/plan.md:44`). The figure is lazy-loaded and used only by `TechniqueTooltip`.
- **Frontend groups:** `MUSCLE_GROUPS` and `MUSCLE_PARENTS` live in `frontend/src/utils/muscleGroups.ts:3-34`; the exercise form, list filter and stats page are all driven by them. Labels come from `muscle.*` and `muscleStats.parent.*` in `en.json` and `pl.json`; exercise names and technique cues are keyed by slug in the same files.

## Desired End State

- The enum has `UPPER_CHEST`, `MID_CHEST`, `LOWER_CHEST` in the position `CHEST` held, and no `CHEST`.
- No `CHEST` string remains anywhere in the database after V14. Incline dumbbell press is upper chest; bench press, chest fly, push-up (primary) and close-grip bench press (secondary) are mid chest; custom CHEST exercises are mid chest; decline bench press and chest dip exist as lower chest.
- The tooltip figure highlights exactly one of three bands per side for each region.
- The exercise form and list filter offer Upper, Mid and Lower chest as separate options; the stats page shows a "Chest" parent row summing the three, expandable to the three children.
- All suites pass, and no existing screenshot baseline changed.

### Key Discoveries:

- `MuscleGroupStatsControllerTest.java:177` asserts `groups[0]` is `CHEST`, so it depends on enum order and must change.
- `SplitShouldersMigrationTest` inserts a custom exercise with primary `CHEST` and asserts it is still `CHEST` after migrating to the latest version (lines 38-47); it will fail after V14 and must expect `MID_CHEST`.
- `ExerciseSeedTest` asserts a catalogue size of 48 and many slug-to-group expectations; sizes become 50.
- `MuscleFigure.test.tsx:50-57` requires every group in `MUSCLE_GROUPS` to have a path, so the constants and the figure data must change in the same phase.
- `e2e/muscle-map.spec.ts:53-55` asserts the chest is idle for Barbell Row via `data-muscle="CHEST"`; `e2e/muscle-group-stats.spec.ts` logs sets for `CHEST` and reads the `CHEST` parent row.
- `e2e/muscle-map.spec.ts:93` aborts routes matching `**/MuscleFigure*`; no new chunk may be named so that it matches unintentionally.

## What We're NOT Doing

- Not keeping `CHEST` in the enum, and not adding a separate `chest_region` field.
- Not guessing a region from a custom exercise's name; every custom `CHEST` becomes `MID_CHEST`.
- Not adding secondary chest regions to the seeded presses (no overlap tagging).
- Not adding screenshot baselines for the figure and not refreshing any existing baseline.
- Not changing how stats are counted (primary group only) or adding backend aggregation for a "Chest" total; the parent row stays frontend-only.
- Not grouping the exercise form and filter by parent; they stay a flat list.
- Not regenerating the whole figure from a different source library.
- Not adding a generator script to the repo (the cutting script stays outside it, like the earlier ones).
- Not touching `context/changes/exercise-form-demos/` (an in-flight change); see the risks in the brief.

## Implementation Approach

Work backend-first so the schema and enum are authoritative, then the figure with its constants, then the UI text and e2e, then docs and the full suites. Phases 1 to 3 break the frontend/backend contract if shipped separately (the frontend would send `CHEST`), so they land on one branch and merge together. The migration follows V12's ordering rules so custom data converts deterministically.

## Critical Implementation Details

- **State sequencing:** in V14 the by-slug update of `incline-dumbbell-press` must run before the blanket `CHEST` to `MID_CHEST` conversion, and primaries must be converted before secondaries so the "primary equals target" guard sees converted values (same trap V12 documents).
- **Contract break:** after V14, `GET /api/exercises?muscleGroup=CHEST` is a 400 (unknown enum value). The only client is the frontend filter, which is driven by `MUSCLE_GROUPS`.

## Phase 1: Backend model and V14 migration

### Overview

Introduce the three leaf values, migrate all stored data, add the two new catalogue exercises and bring the backend tests in line.

### Changes Required:

#### 1. Enum

**File**: `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`

**Intent**: Replace `CHEST` with the three regions in the same position so the dashboard response order stays chest-first.

**Contract**: `MuscleGroup` lists `UPPER_CHEST, MID_CHEST, LOWER_CHEST` as its first three values and has no `CHEST`; all other values and their order are unchanged.

#### 2. Migration V14

**File**: `src/main/resources/db/migration/V14__split_chest_into_regions.sql`

**Intent**: Rewrite stored data the way V12 did for shoulders, then add the two new exercises. Never edit applied migrations; this is a new file.

**Contract**: In order: (1) set `incline-dumbbell-press` primary to `UPPER_CHEST` by slug; (2) set every remaining `CHEST` primary (built-in and custom) to `MID_CHEST`; (3) insert `decline-bench-press` ("Decline Bench Press") and `chest-dip` ("Chest Dip") with `owner_id` null and primary `LOWER_CHEST`, plus secondaries `TRICEPS` and `FRONT_DELTS` for both, with `on conflict do nothing`; (4) insert a `MID_CHEST` secondary for every row whose secondary is `CHEST` unless that exercise's primary is already `MID_CHEST`; (5) delete all `CHEST` secondary rows. Afterwards no `CHEST` value remains in either column.

#### 3. Backend tests

**Files**: `src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java`, `ExerciseControllerTest.java`, `SplitShouldersMigrationTest.java`, `src/test/java/com/example/gymtrack/workout/MuscleGroupStatsControllerTest.java`, plus a new `SplitChestMigrationTest.java` in the exercise test package.

**Intent**: Keep every existing assertion meaningful under the new model and prove the migration on realistic legacy data.

**Contract**:

- `ExerciseSeedTest`: catalogue size 50 (both size assertions); incline press primary `UPPER_CHEST`; bench press, chest fly and push-up primary `MID_CHEST`; close-grip bench press secondaries `MID_CHEST` and `FRONT_DELTS`; the two new slugs have primary `LOWER_CHEST` and secondaries `TRICEPS`, `FRONT_DELTS`.
- `ExerciseControllerTest`: the group filter and substitute assertions use `MID_CHEST` (and one case for `LOWER_CHEST` returning the two new exercises).
- `SplitShouldersMigrationTest`: the custom exercise that had primary `CHEST` now expects `MID_CHEST`; its secondaries expectation is unchanged.
- `MuscleGroupStatsControllerTest`: the order assertion (line 177) expects the new first three values; fixtures that call `catalogExercise(CHEST)` use `MID_CHEST`.
- `SplitChestMigrationTest` (plain Flyway plus Testcontainers like `SplitShouldersMigrationTest`): migrate to version 13, insert custom exercises with primary `CHEST`, with secondary `CHEST`, and with both a `CHEST` primary and another secondary; migrate to latest; assert primaries and secondaries convert to `MID_CHEST` without duplicates, no `CHEST` remains in either table, and the built-in re-tags hold.

### Success Criteria:

#### Automated Verification:

- Backend suite passes with the new enum and migration: `./mvnw test`
- Chest migration test passes: `./mvnw test -Dtest=SplitChestMigrationTest`
- Seed expectations (50 exercises, re-tagged built-ins, two new LOWER_CHEST rows) pass: `./mvnw test -Dtest=ExerciseSeedTest`

#### Manual Verification:

- With the local profile on local Postgres, `GET /api/exercises?muscleGroup=LOWER_CHEST` returns decline bench press and chest dip, and `GET /api/exercises?muscleGroup=UPPER_CHEST` returns incline dumbbell press

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Figure artwork with preview gate

### Overview

Cut the existing chest paths into three bands per side, get the user's approval on a rendered preview, then commit the paths and switch the frontend group constants so the figure and constants agree.

### Changes Required:

#### 1. Artwork cutting (outside the repo)

**File**: none committed; a throwaway script in the scratchpad directory and a preview image or HTML file for review.

**Intent**: Produce upper, mid and lower sub-paths for the left and right chest in the front view by clipping each existing `CHEST` path with horizontal bands, starting at thirds of the path's bounding-box height, and render the figure with the three regions in distinct colours so the cut lines can be judged. Keep the licensed `@musclemap/assets` geometry and silhouette; do not hand-draw.

**Contract**: Output is six integer-rounded paths (three per side) whose union covers the original chest shape with no gaps or overlaps along the cut lines. The script is run with `node -I` from a separate directory and only its output is committed, as in the earlier figure changes. Band boundaries may be adjusted after the user sees the preview. Implementation stops here until the user approves the preview.

#### 2. Figure data

**File**: `frontend/src/components/muscleFigureData.ts`

**Intent**: Replace the two `CHEST` entries in the front view with the six approved entries, keeping the rest of the data, the viewBox and the header credit unchanged.

**Contract**: `MUSCLE_FIGURE.front.muscles` holds two paths each for `UPPER_CHEST`, `MID_CHEST` and `LOWER_CHEST` (`group` strings), and no `CHEST`; the back view is unchanged.

#### 3. Group constants

**File**: `frontend/src/utils/muscleGroups.ts`

**Intent**: Make the TypeScript model match the backend so the figure test, which iterates `MUSCLE_GROUPS`, stays consistent.

**Contract**: `MUSCLE_GROUPS` replaces `'CHEST'` with `'UPPER_CHEST', 'MID_CHEST', 'LOWER_CHEST'` in that position; `MUSCLE_PARENTS` keeps the parent key `CHEST` with `groups: ['UPPER_CHEST', 'MID_CHEST', 'LOWER_CHEST']`.

#### 4. Figure and constants tests

**Files**: `frontend/src/components/MuscleFigure.test.tsx`, `MuscleFigure.plainBody.test.tsx`, `frontend/src/utils/muscleGroups.test.ts`

**Intent**: Cover the new regions and keep fixtures valid.

**Contract**: `MuscleFigure.test.tsx` asserts two paths per chest region in the front view and zero in the back, that no path has group `CHEST`, and that a primary `UPPER_CHEST` with secondary `LOWER_CHEST` yields only those two regions highlighted (`MID_CHEST` idle); `MuscleFigure.plainBody.test.tsx` and `muscleGroups.test.ts` switch their `CHEST` fixtures and expected order to the new values.

### Success Criteria:

#### Automated Verification:

- Frontend unit tests pass: `npm run test` (from `frontend/`)
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- The rendered preview of the three chest bands per side was reviewed and approved by the user before the paths were committed
- In the dev server (`npm run dev`), opening the technique tooltip of incline dumbbell press highlights only the upper band, and decline bench press only the lower band, on both sides of the front view

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Frontend integration

### Overview

Add the labels, the two new exercises' names and technique cues, and update the remaining unit and e2e tests that reference `CHEST`.

### Changes Required:

#### 1. Muscle labels

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Label the three groups and drop the now-unused `muscle.CHEST` key; the stats parent label `muscleStats.parent.CHEST` stays.

**Contract**: `muscle.UPPER_CHEST`, `muscle.MID_CHEST`, `muscle.LOWER_CHEST` exist in both files ("Upper chest", "Mid chest", "Lower chest" and natural Polish equivalents consistent with the existing "Przednia/Boczna/Tylna głowa barku" style); `muscle.CHEST` is removed.

#### 2. New exercises: names and technique cues

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Give `decline-bench-press` and `chest-dip` the same treatment as every seeded slug.

**Contract**: An entry under the exercise-names map and an entry under `exerciseTechnique` for each slug in both languages; cue lists follow the existing style (four short sentences each, as for `barbell-bench-press`).

#### 3. Remaining unit tests

**File**: `frontend/src/components/MuscleMap.test.tsx`

**Intent**: Keep the aria-label and legend tests meaningful with new group names.

**Contract**: `CHEST` fixtures become a region (for example `MID_CHEST`) with the English and Polish labels from step 1.

#### 4. End-to-end specs

**Files**: `frontend/e2e/muscle-map.spec.ts`, `frontend/e2e/muscle-group-stats.spec.ts`, `frontend/e2e/dashboard-ui.spec.ts`, `frontend/e2e/workout-ui.spec.ts`, `frontend/e2e/data-isolation.spec.ts`

**Intent**: Replace `CHEST` as a muscle value with the right region and keep the Chest parent row assertions.

**Contract**: `muscle-map.spec.ts` checks Barbell Row leaves the three chest regions idle and adds a case where incline dumbbell press highlights `UPPER_CHEST` as primary; `muscle-group-stats.spec.ts` logs sets for `MID_CHEST` and still reads the `CHEST` parent row, and checks the parent total includes sets from two different chest regions; the other three specs only change the group value used as test data. No screenshot baseline is edited.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type check and build pass: `npm run build`
- Main bundle grows by at most 1 KB gzipped versus the build before this change (compare the sizes printed by `npm run build`); the figure chunk may grow slightly
- Lint and hard-coded value guard pass: `npm run lint` and `npm run check:tokens`
- End-to-end suite passes with Postgres running: `npm run test:e2e`

#### Manual Verification:

- The exercise form primary select and secondary checkboxes, and the list filter, show Upper, Mid and Lower chest in place of Chest, in English and Polish
- The muscle stats page shows one "Chest" parent row whose total equals the sum of its three child rows
- The technique tooltip for decline bench press and chest dip shows their cues in both languages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Docs and full suites

### Overview

Update project guidance and run every suite once on the finished branch.

### Changes Required:

#### 1. Project guidance

**File**: `CLAUDE.md`

**Intent**: Keep the migration note accurate after V14 lands.

**Contract**: The sentence "next is V14" becomes "next is V15"; nothing else in the file changes.

### Success Criteria:

#### Automated Verification:

- Full backend suite passes: `./mvnw test`
- Full frontend suite passes: `npm run test` and `npm run build` (from `frontend/`)
- Full end-to-end suite passes: `npm run test:e2e`, and `git status` shows no changed PNG under `frontend/e2e/*-snapshots/`

#### Manual Verification:

- `CLAUDE.md` names V15 as the next migration, and a final look at the tooltip figure for one upper, one mid and one lower chest exercise matches the approved preview

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Backend: seed expectations, controller filter and substitutes, stats order and fixtures.
- Frontend: region path counts per view, state resolution for the three regions, `MUSCLE_GROUPS` order, aria-label with the new names.
- Edge cases: custom exercise with only a `CHEST` secondary; custom exercise with a `CHEST` primary and other secondaries; no duplicate secondary rows after conversion.

### Integration Tests:

- `SplitChestMigrationTest` on a real Postgres via Testcontainers, migrating from V13 with legacy rows.
- Playwright: tooltip highlights per region, stats parent row summing multiple regions.

### Manual Testing Steps:

1. Open the technique tooltip of incline dumbbell press, barbell bench press and decline bench press and check the lit band.
2. Create a custom exercise with the new chest options and confirm it saves and appears under the right filter.
3. Log sets on exercises from two chest regions and check the stats page parent total.

## Performance Considerations

The figure chunk gains four extra path entries, which is negligible. The main bundle must not grow by more than 1 KB gzipped, which the build comparison in Phase 3 checks.

## Migration Notes

V14 runs on every deploy against Supabase. Per CLAUDE.md, never point a local run at the Supabase DB. Custom exercises lose no data: every `CHEST` becomes `MID_CHEST`, so historical set counts move to the Mid chest row until owners edit their exercises. The change cannot be rolled back by editing V14; a fix after deploy needs a new `V15`.

## References

- Prior art: `src/main/resources/db/migration/V12__split_shoulders_add_adductors_abductors.sql`, `src/test/java/com/example/gymtrack/exercise/SplitShouldersMigrationTest.java`
- Figure history: `context/changes/precise-muscle-figure/plan.md`, `context/archive/2026-11-17-extend-muscle-groups/plan.md`
- Groups and parents: `frontend/src/utils/muscleGroups.ts:3-34`
- Dashboard aggregation: `src/main/java/com/example/gymtrack/workout/DashboardService.java:166-192`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend model and V14 migration

#### Automated

- [x] 1.1 Backend suite passes with the new enum and migration: `./mvnw test` — e3783ce
- [x] 1.2 Chest migration test passes: `./mvnw test -Dtest=SplitChestMigrationTest` — e3783ce
- [x] 1.3 Seed expectations (50 exercises, re-tagged built-ins, two new LOWER_CHEST rows) pass: `./mvnw test -Dtest=ExerciseSeedTest` — e3783ce

#### Manual

- [x] 1.4 Local API filter returns the expected exercises for LOWER_CHEST and UPPER_CHEST — e3783ce

### Phase 2: Figure artwork with preview gate

#### Automated

- [x] 2.1 Frontend unit tests pass: `npm run test`
- [x] 2.2 Type check and build pass: `npm run build`
- [x] 2.3 Lint passes: `npm run lint`

#### Manual

- [x] 2.4 Rendered preview of the three chest bands per side reviewed and approved by the user
- [x] 2.5 Tooltip highlights only the upper band for incline dumbbell press and only the lower band for decline bench press

### Phase 3: Frontend integration

#### Automated

- [ ] 3.1 Unit tests pass: `npm run test`
- [ ] 3.2 Type check and build pass: `npm run build`
- [ ] 3.3 Main bundle grows by at most 1 KB gzipped versus the build before this change
- [ ] 3.4 Lint and hard-coded value guard pass: `npm run lint` and `npm run check:tokens`
- [ ] 3.5 End-to-end suite passes with Postgres running: `npm run test:e2e`

#### Manual

- [ ] 3.6 Form select, checkboxes and list filter show Upper, Mid and Lower chest in English and Polish
- [ ] 3.7 Stats page Chest parent total equals the sum of its three child rows
- [ ] 3.8 Technique tooltip for decline bench press and chest dip shows cues in both languages

### Phase 4: Docs and full suites

#### Automated

- [ ] 4.1 Full backend suite passes: `./mvnw test`
- [ ] 4.2 Full frontend suite passes: `npm run test` and `npm run build`
- [ ] 4.3 Full end-to-end suite passes and no snapshot PNG changed

#### Manual

- [ ] 4.4 CLAUDE.md names V15 as the next migration and the final figure check matches the approved preview
