# Extend muscle groups (split deltoids, adductors, abductors) Implementation Plan

## Overview

Replace the single `SHOULDERS` muscle group with `FRONT_DELTS`, `SIDE_DELTS` (middle) and `REAR_DELTS`, and add `ADDUCTORS` and `ABDUCTORS`. Existing built-in exercises are retagged, eight new built-in exercises give the new groups something to pick and highlight, and the body figure is re-split so each new group has its own highlighted region. This follows the precedent of `V10__refine_muscle_groups.sql` (split of `BACK` / `CORE`).

## Current State Analysis

- One Java enum, `MuscleGroup` (14 values, `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`), stored as `varchar(32)` in `exercises.primary_muscle_group` and `exercise_secondary_muscle_groups.muscle_group` with `@Enumerated(EnumType.STRING)` and no check constraint (V2). Adding values needs no schema change; removing `SHOULDERS` needs a data migration.
- The frontend mirrors the enum in `MUSCLE_GROUPS` (`frontend/src/utils/muscleGroups.ts`) and labels in `muscle.*` (`en.json`, `pl.json`). `ExerciseFormPage.tsx`, `ExercisesPage.tsx` and others render from that list.
- The muscle stats response iterates `MuscleGroup.values()` (`DashboardService.java:183`), so enum order is the display order and every enum value appears in the stats.
- Seeded exercises are inserted by slug in migrations; `locales.test.ts` parses all migrations (`insert into exercises ...`) and requires an `exercises.<slug>` name and 3-4 `exerciseTechnique.<slug>` cues in both languages for every seeded slug.
- `ExerciseSeedTest` hard-codes 40 exercises, a per-group "at least three primaries" rule (with an exemption set for groups introduced by V10) and slug-level remap assertions. `ExerciseControllerTest` and `CustomExerciseControllerTest` hard-code 40 / 41 list sizes.
- The body figure (`frontend/src/components/muscleFigureData.ts`) was vendored from `@musclemap/assets` 1.1.0 (MIT). Its source has `SHOULDER_FRONT/SIDE/REAR`, `ADDUCTOR` and `ABDUCTOR` surfaces, but our vendoring collapsed every shoulder path into `SHOULDERS` (8 paths) and mapped adductors/abductors to `null` ("never highlighted"). Re-splitting needs the source paths again.
- `main` currently has migration `V10` as the latest. Open PR #64 (favourites) adds `V11`; this change needs `V12` on top of it.

## Desired End State

- Muscle groups: `FRONT_DELTS`, `SIDE_DELTS`, `REAR_DELTS`, `ADDUCTORS`, `ABDUCTORS` exist; `SHOULDERS` is gone everywhere (enum, DB rows, frontend list, labels, figure).
- Built-in exercises are retagged correctly; 8 new built-in exercises exist with EN/PL names and technique cues; the catalogue has 48 exercises.
- Existing custom exercises survive: primary `SHOULDERS` becomes `SIDE_DELTS`, secondary `SHOULDERS` becomes `FRONT_DELTS`. Logged history follows automatically because stats group by the exercise's primary.
- The body figure highlights front, side and rear delts, adductors and abductors independently.
- The exercise form and the exercises filter list all new groups in a sensible order, in EN and PL.
- The muscle stats page shows six collapsible parent rows (Chest, Back, Shoulders, Arms, Legs, Core), each with the summed sets of its sub-groups; expanding Shoulders shows front, side and rear delts, Back shows lats, traps and lower back, and so on. Grouping and summing happen in the frontend; the stats API stays a flat per-group list.

Verification: backend tests (including a migration-over-data test), Vitest, `npm run build` / `lint` / `check:tokens`, Playwright (muscle-map spec and full suite), and a visual check of the figure.

### Key Discoveries:

- `src/main/resources/db/migration/V10__refine_muscle_groups.sql` is the template: retag built-ins by slug, convert custom rows with fallbacks, delete the retired value, `on conflict do nothing` for secondaries.
- `src/main/java/com/example/gymtrack/workout/DashboardService.java:183` - stats are built from `MuscleGroup.values()`, so the enum order is user-visible.
- `frontend/src/i18n/locales.test.ts:56-64` - the seeded-slug scanner matches `insert into exercises ... ('slug', 'Name', ...)` rows; new exercises must use that exact insert shape to be picked up (and thereby require translations).
- `src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java:44-60` - the "three primaries per group" rule needs an exemption for groups that gain fewer than three exercises.
- `frontend/src/components/muscleFigureData.ts:7-9` - vendoring notes: source ADDUCTORS/ABDUCTORS map to `null` today.

## What We're NOT Doing

- No rhomboids, hip flexors, neck, tibialis, upper/lower chest or triceps heads (not requested, or not supported by the figure).
- No change to how stats count sets (still the primary group of the exercise) and no recomputation of history beyond the exercise retag.
- No reclassification of users' custom exercises beyond the agreed fallback (primary to `SIDE_DELTS`, secondary to `FRONT_DELTS`); users can edit them.
- No new design tokens; no visual redesign of the form or figure beyond the new regions; the stats page changes only to the collapsible parent rows.
- No stats API or backend contract change for the grouping (frontend-only presentation); no forearm split (Forearms stays one group under Arms).
- No persistence of which parent rows are expanded.
- No refresh of screenshot baselines unless a visual delta from this change is explained and approved.

## Implementation Approach

Backend first (enum, one data migration, tests), because the frontend locale test reads the migrations for seeded slugs. Then the frontend foundation (list, labels, names, technique cues), then the figure (the only part needing external source data), then a pass over the surfaces and docs with the full suites. Migration `V12` is a single file so retag, custom conversion and new inserts are atomic. Merge PR #64 (V11) before starting, so the version numbers are linear.

## Critical Implementation Details

- **Migration order of operations**: convert/retag data first, insert new exercises second, and only then rely on the new values; never leave a stored `SHOULDERS` value, because `@Enumerated(STRING)` would fail to load such rows. Custom rows whose primary is `SHOULDERS` must be converted before any secondary conversion so the "secondary must not equal primary" invariant holds (`SIDE_DELTS` primary with `FRONT_DELTS` secondary is fine; a row with primary `SHOULDERS` and secondary `SHOULDERS` cannot exist).
- **Enum order is display order**: place the three delt groups where `SHOULDERS` was (after `LOWER_BACK`) in the enum, `muscleGroups.ts` and the labels; place `ADDUCTORS` and `ABDUCTORS` after `GLUTES`.
- **Figure source data**: the extraction needs the `@musclemap/assets@1.1.0` package tarball. Download it into a scratch folder only (never extract inside the repo), run the throwaway remap script with `node -I`, and commit only the regenerated `muscleFigureData.ts` plus the updated notice. A first attempt to download it was denied by the permission layer, so expect to approve it at implementation time.

## Phase 1: Backend groups, data migration and catalogue

### Overview

Change the enum and add `V12` so the database, built-in catalogue and custom data match the new groups. Update backend tests.

### Changes Required:

#### 1. Enum

**File**: `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`

**Intent**: Remove `SHOULDERS`; add `FRONT_DELTS`, `SIDE_DELTS`, `REAR_DELTS`, `ADDUCTORS`, `ABDUCTORS`.

**Contract**: Order `CHEST, LATS, TRAPS, LOWER_BACK, FRONT_DELTS, SIDE_DELTS, REAR_DELTS, BICEPS, TRICEPS, FOREARMS, QUADS, HAMSTRINGS, GLUTES, ADDUCTORS, ABDUCTORS, CALVES, ABS, OBLIQUES`. Other code reads values through the enum, so no further backend source change is expected; compile errors would point at any other `SHOULDERS` reference.

#### 2. Migration V12

**File**: `src/main/resources/db/migration/V12__split_shoulders_add_adductors_abductors.sql`

**Intent**: In one migration: retag built-ins by slug, convert custom rows, insert the 8 new exercises with secondaries, and remove every stored `SHOULDERS`.

**Contract**:
- Built-in primaries: `overhead-press` and `arnold-press` become `FRONT_DELTS`; `lateral-raise` becomes `SIDE_DELTS`; `face-pull` becomes `REAR_DELTS`.
- Built-in secondaries (replace stored `SHOULDERS`): `barbell-bench-press`, `incline-dumbbell-press`, `push-up`, `close-grip-bench-press`, `plank`, `ab-wheel-rollout` get `FRONT_DELTS`; add `SIDE_DELTS` as a secondary of `overhead-press` and `arnold-press`; `face-pull` keeps `TRAPS` and gains nothing else.
- Custom rows: primary `SHOULDERS` becomes `SIDE_DELTS`; secondary `SHOULDERS` becomes `FRONT_DELTS` (skip when it would equal the row's primary), then delete remaining `SHOULDERS` secondaries.
- New exercises, inserted with the `insert into exercises (slug, name, primary_muscle_group) values` shape the locale test scans: `hip-adduction-machine` and `copenhagen-plank` (`ADDUCTORS`), `hip-abduction-machine` and `banded-lateral-walk` (`ABDUCTORS`), `reverse-pec-deck` and `bent-over-rear-delt-fly` (`REAR_DELTS`), `front-raise` (`FRONT_DELTS`), `cable-lateral-raise` (`SIDE_DELTS`). Secondaries: Copenhagen plank `ABS`, `OBLIQUES`; banded lateral walk `GLUTES`; reverse pec deck and rear-delt fly `TRAPS`; front raise `SIDE_DELTS`; cable lateral raise `FRONT_DELTS`; machine exercises have none. A secondary must never equal its primary.

#### 3. Seed and controller tests

**File**: `src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java`, `ExerciseControllerTest.java`, `CustomExerciseControllerTest.java`

**Intent**: Update counts to 48 (and 49 with one custom exercise), extend the "three primaries" exemption to the groups that gain fewer than three exercises (`ADDUCTORS`, `ABDUCTORS`, `FRONT_DELTS` if applicable), add slug-level assertions for the retags and new exercises, and assert no stored `SHOULDERS` remains (extend `noStoredGroupIsARetiredOne` to `SHOULDERS`).

**Contract**: Assertions on stored values and counts only; no production code change expected beyond the migration.

#### 4. Migration-over-data test

**File**: `src/test/java/com/example/gymtrack/exercise/` (new test class, e.g. `SplitShouldersMigrationTest`)

**Intent**: Prove the custom-data conversion: migrate a fresh container to V11, insert a custom exercise with primary `SHOULDERS` and one with secondary `SHOULDERS`, migrate to latest, and assert `SIDE_DELTS` / `FRONT_DELTS` plus no leftover `SHOULDERS`.

**Contract**: Uses Flyway's API with a target version against the Testcontainers database (no Spring context reuse with the other tests); depends on V11 existing, hence on #64 being merged first.

### Success Criteria:

#### Automated Verification:

- Exercise tests pass, including V12 applying on a fresh container: `./mvnw test -Dtest='ExerciseSeedTest,ExerciseControllerTest,CustomExerciseControllerTest'`
- Migration-over-data test passes: `./mvnw test -Dtest='SplitShouldersMigrationTest'`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the `local` profile and Postgres running, `GET /api/exercises` shows the retagged built-ins and the 8 new exercises, and `GET /api/dashboard/muscle-groups` (stats endpoint) lists the new groups in the agreed order.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend foundation

### Overview

Make the frontend know the new groups and the new exercises: list, labels, names, technique cues.

### Changes Required:

#### 1. Group list

**File**: `frontend/src/utils/muscleGroups.ts`, `frontend/src/utils/muscleGroups.test.ts`

**Intent**: Mirror the enum order exactly; update the test that lists the groups.

**Contract**: `MUSCLE_GROUPS` equals the backend order from Phase 1; `SHOULDERS` removed.

#### 2. Labels and exercise content

**File**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Add `muscle.*` labels for the five new groups (remove `SHOULDERS`), `exercises.<slug>` names and `exerciseTechnique.<slug>` cues for the 8 new slugs, in both languages.

**Contract**: Labels: Front delts / Side delts / Rear delts / Adductors / Abductors (natural Polish equivalents, e.g. przednie / boczne / tylne aktony barków, przyciągacze, odwodziciele). Each new slug needs a name and 3-4 non-empty cues in both languages (enforced by `locales.test.ts`); keys of removed groups must not remain.

#### 3. Tests using the old group

**File**: `frontend/src/components/MuscleFigure.test.tsx` and any other test or fixture referencing `SHOULDERS`

**Intent**: Replace `SHOULDERS` with a new group so tests keep their meaning.

**Contract**: No behaviour change in `MuscleFigure` in this phase.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including locale parity and the seeded-slug name and technique checks: `cd frontend && npm test`
- Type check and build pass: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- None; no visible UI beyond new labels (checked in Phases 4 and 5).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Body figure

### Overview

Re-vendor the figure so front, side and rear delts, adductors and abductors are separate regions.

### Changes Required:

#### 1. Figure data

**File**: `frontend/src/components/muscleFigureData.ts`, `THIRD_PARTY_NOTICES.md` (only if the notice text needs updating)

**Intent**: Regenerate the segmented paths from `@musclemap/assets@1.1.0` with the new remap: `SHOULDER_FRONT*` to `FRONT_DELTS`, `SHOULDER_SIDE*` to `SIDE_DELTS`, `SHOULDER_REAR*` to `REAR_DELTS`, `ADDUCTOR*` to `ADDUCTORS`, `ABDUCTOR*` to `ABDUCTORS`; everything else maps as before, and the header comment is updated.

**Contract**: `MuscleFigurePath.group` stays `string | null`; groups are our enum names; de-duplication and integer rounding as before; no group other than the five new ones changes. The throwaway extraction script lives outside the repo.

#### 2. Figure tests and e2e

**File**: `frontend/src/components/MuscleFigure.test.tsx`, `frontend/e2e/muscle-map.spec.ts`

**Intent**: Prove every selectable group (all 18) has at least one region in the figure and that primary/secondary states work for a delt and an adductor exercise.

**Contract**: Unit test iterates `MUSCLE_GROUPS` against the figure data; e2e adds a case that opens a new exercise (e.g. Hip Adduction Machine or Reverse Pec Deck) and asserts `data-muscle` regions with the expected `data-state`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including "every group has a region": `cd frontend && npm test`
- Build and lint pass: `cd frontend && npm run build && npm run lint`
- Muscle-map e2e passes: `cd frontend && npm run test:e2e -- muscle-map`

#### Manual Verification:

- Front, side and rear delts are visibly distinct on the figure (front and back views) for Overhead Press, Lateral Raise and Reverse Pec Deck; adductors and abductors highlight on the thighs for the new exercises; light and dark themes look right.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Collapsible muscle stats

### Overview

Turn the flat stats list into parent rows (Chest, Back, Shoulders, Arms, Legs, Core) that expand to their sub-groups, computed in the frontend from the unchanged per-group API response.

### Changes Required:

#### 1. Parent grouping

**File**: `frontend/src/utils/muscleGroups.ts` (+ `muscleGroups.test.ts`)

**Intent**: One definition of the hierarchy, used by the stats page.

**Contract**: `MUSCLE_PARENTS`: Chest [CHEST]; Back [LATS, TRAPS, LOWER_BACK]; Shoulders [FRONT_DELTS, SIDE_DELTS, REAR_DELTS]; Arms [BICEPS, TRICEPS, FOREARMS]; Legs [QUADS, HAMSTRINGS, GLUTES, ADDUCTORS, ABDUCTORS, CALVES]; Core [ABS, OBLIQUES]. Unit test: every group in `MUSCLE_GROUPS` belongs to exactly one parent and no parent lists an unknown group.

#### 2. Labels

**File**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Parent labels and the expand/collapse text.

**Contract**: Keys for the six parents (e.g. Chest/Klatka, Back/Plecy, Shoulders/Barki, Arms/Ręce, Legs/Nogi, Core/Brzuch) and an accessible label for the toggle that includes the parent name (e.g. "Show {{name}} details"); parity enforced by `locales.test.ts`.

#### 3. Collapsible rows

**File**: `frontend/src/pages/MuscleGroupStatsPage.tsx`, `frontend/src/styles/muscle-groups.css`

**Intent**: Render parents sorted by summed sets (stable, ties keep the hierarchy order); a parent with several sub-groups gets a disclosure button (`aria-expanded`, `aria-controls` pointing at its sub-list), collapsed by default; expanded sub-groups are sorted by sets within the parent and each shows its own bar and count. Chest has a single group and renders as a plain row without a toggle. The total line and empty states are unchanged.

**Contract**: Local expansion state per parent (not persisted, kept when the time window changes); parent bars scale to the largest parent, sub-group bars scale to the total of their parent so they read as a share; zero-set sub-groups are still listed. The toggle is a real button with hover and focus-visible states, a minimum 44px target and a rotating chevron or equivalent non-colour cue; tokens only (`check:tokens`).

#### 4. Specs

**File**: `frontend/e2e/muscle-group-stats.spec.ts`

**Intent**: Update the existing spec to the new structure and add expand/collapse coverage.

**Contract**: Parent rows with summed counts; expanding Shoulders shows front, side and rear delts with their sets; collapsed by default; toggle exposes `aria-expanded`; keyboard (Enter/Space) toggles; counts stay correct when switching the 7/30/90/All window; Polish labels.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the hierarchy test and locale parity: `cd frontend && npm test`
- Build, lint and token guard pass: `cd frontend && npm run build && npm run lint && npm run check:tokens`
- Stats specs pass: `cd frontend && npm run test:e2e -- muscle-group-stats`

#### Manual Verification:

- Parent rows look right collapsed and expanded in EN and PL, light and dark, at phone width; keyboard toggling works and the focus ring is visible.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 5: Surfaces, docs and full suites

### Overview

Check every place the group list appears and close out docs and regressions.

### Changes Required:

#### 1. Surfaces

**File**: `frontend/src/pages/MuscleGroupStatsPage.tsx`, `ExerciseFormPage.tsx`, `ExercisesPage.tsx`, picker and substitute components

**Intent**: Confirm the new groups render in the exercise form (primary select and secondary checkboxes), the exercises muscle filter and substitute suggestions; fix only what breaks (long Polish labels, layout of 18 groups, chart colours or counts).

**Contract**: No new tokens; layout fixes use existing classes. Any unexpected visual delta in `dashboard-ui` / `workout-ui` baselines is reported before refreshing anything.

#### 2. Docs

**File**: `CLAUDE.md`, `README.md`

**Intent**: Update the "next migration" note to V13 and mention the expanded muscle groups where the README describes them.

**Contract**: Text edits only.

### Success Criteria:

#### Automated Verification:

- Build, lint, unit tests and token guard pass: `cd frontend && npm run build && npm run lint && npm test && npm run check:tokens`
- Full e2e suite passes with no baseline changes: `cd frontend && npm run test:e2e`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Stats page, exercise form and exercises filter look right with 18 groups in EN and PL, light and dark, and at phone width.
- A custom exercise created before the migration (primary Shoulders) now shows as Side delts and still opens, edits and logs sets.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before closing the change.

---

## Testing Strategy

### Unit Tests:

- Frontend: group list order and completeness, locale parity plus seeded name and technique checks for the new slugs, figure has a region for every group.

### Integration Tests:

- Backend: seed counts, slug-level retag assertions, no stored `SHOULDERS`, stats list the new groups, migration-over-data test for custom exercises.
- Playwright: muscle-map spec for a delt and an adductor exercise; the existing exercises, workout and plan specs stay unchanged.

### Manual Testing Steps:

1. Open Exercises, filter by each new group, open the muscle map of the new exercises.
2. Create an exercise with a new primary and secondaries; check the figure and the stats after logging a set.
3. In Polish, check labels and long names in the form and filters.
4. Check an exercise created before the migration.

## Performance Considerations

None: the catalogue grows from 40 to 48 rows and the stats response from 14 to 18 groups.

## Migration Notes

`V12__split_shoulders_add_adductors_abductors.sql` changes existing data (retags built-ins, converts custom rows, adds 8 catalogue rows). Flyway applies it to the Supabase database on the next deploy; never edit it once applied there. Rollback is not scripted: the conversion of custom `SHOULDERS` rows is lossy (all become `SIDE_DELTS` / `FRONT_DELTS`), so take a backup of the exercise tables before the first production deploy. Requires PR #64 (`V11`) merged first.

## References

- Change identity: `context/changes/extend-muscle-groups/change.md`
- Precedent: `src/main/resources/db/migration/V10__refine_muscle_groups.sql`, `src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java`
- Figure source and licence notes: `frontend/src/components/muscleFigureData.ts:1-9`, `THIRD_PARTY_NOTICES.md`
- MuscleMap source identifiers: `packages/assets/src/surface-ids.ts` in `github.com/Jsplice/MuscleMap` (surfaces `SHOULDER_FRONT/SIDE/REAR`, `ADDUCTOR`, `ABDUCTOR`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend groups, data migration and catalogue

#### Automated

- [x] 1.1 Exercise tests pass, including V12 applying on a fresh container — 5380db0
- [x] 1.2 Migration-over-data test passes — 5380db0
- [x] 1.3 Full backend suite passes — 5380db0

#### Manual

- [x] 1.4 Local API shows retagged built-ins, the 8 new exercises and the new groups in the stats — 5380db0

### Phase 2: Frontend foundation

#### Automated

- [x] 2.1 Unit tests pass, including locale parity and seeded name and technique checks — e4ba85d
- [x] 2.2 Type check and build pass — e4ba85d
- [x] 2.3 Lint passes — e4ba85d

### Phase 3: Body figure

#### Automated

- [x] 3.1 Unit tests pass, including every group has a figure region — e4ba85d
- [x] 3.2 Build and lint pass — e4ba85d
- [x] 3.3 Muscle-map e2e passes — e4ba85d

#### Manual

- [x] 3.4 Delts, adductors and abductors are visibly distinct and highlight correctly in light and dark — e4ba85d

### Phase 4: Collapsible muscle stats

#### Automated

- [x] 4.1 Unit tests pass, including the hierarchy test and locale parity — da1d837
- [x] 4.2 Build, lint and token guard pass — da1d837
- [x] 4.3 Stats e2e specs pass — da1d837

#### Manual

- [x] 4.4 Parent rows look right collapsed and expanded (EN/PL, light/dark, phone) and keyboard toggling works — da1d837

### Phase 5: Surfaces, docs and full suites

#### Automated

- [x] 5.1 Build, lint, unit tests and token guard pass — 1defda4
- [x] 5.2 Full e2e suite passes with no baseline changes — 1defda4
- [x] 5.3 Full backend suite passes — 1defda4

#### Manual

- [x] 5.4 Exercise form, filters and the collapsible stats look right with 18 groups in EN and PL, light and dark, phone width — 1defda4
- [x] 5.5 A custom exercise created before the migration shows as Side delts and still works — 1defda4
