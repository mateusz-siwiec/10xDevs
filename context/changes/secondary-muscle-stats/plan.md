# Secondary Muscle Stats Implementation Plan

## Overview

Add an "Include secondary muscles" checkbox, off by default, to the sets-per-muscle-group page (`/muscle-groups`) and an `includeSecondary` parameter to `GET /api/dashboard/muscle-groups`. When on, a set also counts for each secondary muscle of its exercise. Sub-rows count every muscle a set trained, parent rows count each set once, and the "N sets in total" line stays the number of sets logged.

An uncommitted first draft already exists on `feat/chest-regions` (param, two repository queries, merge in the service, checkbox, strings, one test). This plan keeps its API parameter, checkbox, strings and CSS, and replaces its counting approach, because the draft's parent rows (summed in the frontend) double-count.

## Current State Analysis

- Secondary muscles are stored in `exercise_secondary_muscle_groups` and mapped on `Exercise.secondaryMuscleGroups` (`Exercise.java:35-38`, `:89`). No schema change is needed.
- `DashboardService.muscleGroupStats` builds its numbers from `WorkoutSetRepository.countSetsByMuscleGroupBetween`, which groups by `e.primaryMuscleGroup` only (`WorkoutSetRepository.java:40-49`, `DashboardService.java:170-192`). The draft added `countSetsBySecondaryMuscleGroupBetween` and a `counts.merge`.
- Parent rows exist only in the frontend: `MUSCLE_PARENTS` (`muscleGroups.ts:29-36`) and `parent.sets = sum of children` (`MuscleGroupStatsPage.tsx:83-93`). Because every set has exactly one primary muscle, the sum was always correct. With secondaries it is not: an overhead press (primary front delts, secondary side delts) would add 2 to Shoulders.
- `MuscleGroupStatsResponse(days, totalSets, groups)` has no parent data (`MuscleGroupStatsResponse.java`).
- The only caller of `countSetsByMuscleGroupBetween` is `DashboardService`.
- Existing tests: `MuscleGroupStatsControllerTest` (13 tests incl. the draft's), `frontend/e2e/muscle-group-stats.spec.ts` (seeds via API, uses `parent()` / `child()` locators), `muscleGroups.test.ts` (parent hierarchy).
- UI rules (`CLAUDE.md`): tokens only, `npm run check:tokens`, new interactive controls need hover, focus-visible and disabled states.

## Desired End State

On `/muscle-groups` the user can tick "Include secondary muscles". The rows reload with secondary muscles counted:

- Each sub-row shows every set that trained that muscle, as primary or secondary. "To failure" counts follow the same rule.
- Each parent row shows the number of distinct sets that trained any of its muscles. Parents are still sorted most-trained first.
- The "N sets in total" line is unchanged by the toggle, and the footnote explains that rows can add up to more than it.
- Untouched, the page and API behave exactly as before (primary only).

Verification: backend controller tests, frontend lint/build/tokens/unit tests and the e2e spec all pass, and the README describes both modes.

### Key Discoveries:

- Parent counts cannot be derived from `groups` alone once a set can hit two muscles of one parent, so the backend must return them (`MuscleGroupStatsResponse.java`).
- Grouping the aggregate query by exercise id gives the per-exercise set and failure counts; expanding each exercise to its muscles in memory yields groups and distinct parents in one pass. Volume per user is small (the service already says it aggregates in memory, `DashboardService.java:26-29`).
- The parent keys (`CHEST`, `BACK`, `SHOULDERS`, `ARMS`, `LEGS`, `CORE`) and membership live in the frontend today (`muscleGroups.ts:29-36`); the backend needs the same mapping, so a test must pin the two together.
- Existing stats query joins `Exercise`, so sets whose exercise row is gone are skipped; keep that behaviour.

## What We're NOT Doing

- No half-weighting of secondary muscles: a secondary muscle gets a full set, so counts stay whole numbers.
- No persistence of the checkbox (no localStorage); it resets on every visit like the expanded parents.
- No segmented-toggle styling; a native checkbox stays.
- No change to the dashboard, history, the muscle figure, or to how exercises store secondary muscles.
- No hiding of the "N sets in total" line, and no change to what `totalSets` means.
- No new database migration.

## Implementation Approach

Move counting to "per exercise, then expand". One aggregate query returns, for each exercise with ended sets in the window, its set count and failure-set count. The service loads those exercises (with secondaries), and for each one adds its counts to the primary muscle, to each secondary muscle when `includeSecondary` is set, and once to each distinct parent of those muscles. `totalSets` is the sum of the per-exercise set counts. The response gains a `parents` list; the frontend reads parent rows from it and keeps `MUSCLE_PARENTS` for hierarchy, ordering and labels. Backend lands first and is tested alone, then the frontend, then docs.

## Phase 1: Backend counting by exercise and parent

### Overview

Replace the primary-only and draft secondary queries with one per-exercise aggregate, add the parent concept to the backend and return `parents` from the endpoint.

### Changes Required:

#### 1. Parent concept on the muscle group

**File**: `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java` (and a new `MuscleParent.java` in the same package)

**Intent**: Give every `MuscleGroup` a parent so the service can count distinct sets per parent, mirroring the frontend hierarchy.

**Contract**: new enum `MuscleParent { CHEST, BACK, SHOULDERS, ARMS, LEGS, CORE }` in declaration order equal to `MUSCLE_PARENTS`; `MuscleGroup.parent()` returns the parent per `MUSCLE_PARENTS` membership (chest regions to CHEST; lats/traps/lower back to BACK; front/side/rear delts to SHOULDERS; biceps/triceps/forearms to ARMS; quads/hamstrings/glutes/adductors/abductors/calves to LEGS; abs/obliques to CORE).

#### 2. One aggregate query per exercise

**File**: `src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java` (new record `ExerciseSetCount` next to `MuscleGroupCount`)

**Intent**: Replace `countSetsByMuscleGroupBetween` and the draft's `countSetsBySecondaryMuscleGroupBetween` with a single query that counts sets and failure sets per exercise over ended sessions in the window.

**Contract**: `List<ExerciseSetCount> countSetsByExerciseBetween(userId, from, to)` with `ExerciseSetCount(UUID exerciseId, long sets, long failureSets)`; same filters as today (`s.session.userId`, `endedAt >= from and < to`, join on `Exercise` so sets with no exercise row are skipped). `MuscleGroupCount` and the two removed queries are deleted once unused.

#### 3. Service expands exercises into muscles and parents

**File**: `src/main/java/com/example/gymtrack/workout/DashboardService.java`

**Intent**: Build `groups` and the new `parents` from the per-exercise counts, adding secondary muscles only when `includeSecondary` is true, and counting each exercise once per parent.

**Contract**: `muscleGroupStats(UUID userId, String window, boolean includeSecondary)`. For each exercise: its sets and failure sets go to the primary group; if `includeSecondary`, also to each secondary group (the primary is never in its own secondary set); and once to each distinct `MuscleGroup.parent()` among those muscles. `totalSets` = sum of the exercises' set counts (not of the group counts). `groups` still lists every `MuscleGroup` in enum order with zeros; `parents` lists every `MuscleParent` in enum order with zeros. Window parsing and `InvalidDashboardWindowException` are unchanged. Exercise lookup goes through `ExerciseRepository` by id, read inside the existing read-only transaction so lazy secondaries load.

#### 4. Response and controller

**File**: `src/main/java/com/example/gymtrack/workout/MuscleGroupStatsResponse.java`, `DashboardController.java`

**Intent**: Expose parent counts and keep the `includeSecondary` request parameter from the draft.

**Contract**: `MuscleGroupStatsResponse(Integer days, long totalSets, List<Group> groups, List<Parent> parents)` with `Parent(MuscleParent parent, long sets, long failureSets)`; `GET /api/dashboard/muscle-groups?days=…&includeSecondary=true|false`, default `false`; non-boolean values yield the framework's 400.

#### 5. Tests

**File**: `src/test/java/com/example/gymtrack/workout/MuscleGroupStatsControllerTest.java`; new `src/test/java/com/example/gymtrack/exercise/MuscleGroupParentTest.java`

**Intent**: Prove the counting rules, especially the parent de-duplication, and pin the backend hierarchy to the frontend one.

**Contract**: keep the draft's secondary test. Add: a set whose primary and secondary share a parent (custom exercise, primary FRONT_DELTS, secondary SIDE_DELTS) counts 1 on SHOULDERS but 1 on each sub-row; secondaries on with failure sets counts failures per muscle and once per parent; `includeSecondary=false` and the absent parameter return identical primary-only numbers; `totalSets` equals logged sets in both modes; `parents` lists all six in order for an empty user; `includeSecondary=abc` returns 400. `MuscleGroupParentTest` asserts every `MuscleGroup` has a parent and that the parent-to-groups mapping equals the lists in `frontend/src/utils/muscleGroups.ts` (read as text, group names per parent key).

### Success Criteria:

#### Automated Verification:

- Stats controller tests pass: `./mvnw test -Dtest=MuscleGroupStatsControllerTest`
- Parent mapping test passes: `./mvnw test -Dtest=MuscleGroupParentTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the `local` profile and Postgres up, `GET /api/dashboard/muscle-groups?includeSecondary=true` returns `parents` with six entries and the same `totalSets` as without the flag.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Frontend toggle and parent rows

### Overview

Make the page read parent rows from the API, keep the checkbox from the draft, give it the required interaction states, and cover it with unit and e2e tests.

### Changes Required:

#### 1. API client types

**File**: `frontend/src/api/client.ts`

**Intent**: Describe the new `parents` field; the `includeSecondary` argument from the draft stays.

**Contract**: `MuscleGroupStats` gains `parents: { parent: string; sets: number; failureSets: number }[]`; `getMuscleGroupStats(days, includeSecondary = false)` unchanged.

#### 2. Page uses API parent counts

**File**: `frontend/src/pages/MuscleGroupStatsPage.tsx`

**Intent**: Stop summing children for parent rows. Parent `sets` and `failureSets` come from `stats.parents`; children, ordering (parents most-trained first, children by sets) and expansion behave as before. Keep the checkbox, refetch on change, the stale-response guard that includes `includeSecondary`, and the footnote switch. The progress bar for a child stays relative to its parent's total, which can now be smaller than the sum of the children, so clamp the width to 100%.

**Contract**: parent figure = `parents.find(key).sets`; child bar width = `min(100, child.sets / parent.sets * 100)`; no change to `data-parent` / `data-group` attributes, so existing e2e locators keep working.

#### 3. Checkbox states

**File**: `frontend/src/styles/muscle-groups.css`

**Intent**: Meet the project rule that every interactive control has hover, focus-visible and disabled states, using tokens only. Draft has focus-visible only.

**Contract**: add a hover treatment on `.muscle-secondary-toggle` and a disabled treatment (cursor and text colour via existing tokens) for the `:disabled` input and its label; the checkbox itself is not disabled by the page. No literal colours or arbitrary values (`npm run check:tokens`).

#### 4. Strings

**File**: `frontend/src/i18n/locales/en.json`, `pl.json`

**Intent**: Keep the draft's `muscleStats.includeSecondary` and `muscleStats.noteSecondary`, and word the secondary footnote so it says a set counts once per parent and once per muscle, so muscle rows can add up to more than the total.

**Contract**: same keys in both languages; no key added or removed elsewhere.

#### 5. Tests

**File**: `frontend/e2e/muscle-group-stats.spec.ts`; `frontend/src/utils/muscleGroups.test.ts` if a helper is added

**Intent**: Prove the user-visible behaviour in the real stack.

**Contract**: new e2e tests: (a) with a custom exercise (primary FRONT_DELTS, secondary SIDE_DELTS), ticking the box keeps Shoulders at 1 and shows 1 on both sub-rows when expanded, the total line stays "1 set in total", and unticking returns to 1 on the front delts row only; (b) a set whose secondary is in another parent (e.g. a built-in chest exercise with a triceps secondary) adds to the second parent's row; (c) Polish: the checkbox label and footnote are translated; (d) keyboard: the checkbox toggles with Space, and an expanded parent stays expanded when the box is ticked.

### Success Criteria:

#### Automated Verification:

- Type check and build pass: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Hard-coded value guard passes: `cd frontend && npm run check:tokens`
- Unit tests pass: `cd frontend && npm run test`
- Muscle stats e2e spec passes: `cd frontend && npx playwright test muscle-group-stats.spec.ts` (Postgres running, `CI` unset)

#### Manual Verification:

- In the browser the checkbox shows hover and a visible keyboard focus ring in light and dark themes.
- Ticking the box on a user with mixed exercises changes sub-rows as expected, and Shoulders never exceeds the number of sets that touched shoulders.
- The page still looks correct at phone width.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Docs and full verification

### Overview

Bring the README rule in line with the new behaviour and run every suite that could be affected.

### Changes Required:

#### 1. README rule

**File**: `README.md` (section "5. Sets per muscle group", around line 136)

**Intent**: Replace "secondary groups are not counted, so the numbers add up to your real set count" with the two modes: primary only by default, and with the checkbox each set also counts for its secondary muscles, once per muscle row and once per parent row, with the total still the number of sets logged.

**Contract**: add a short example (a set of an exercise with primary front delts and secondary side delts: Shoulders +1, front delts +1, side delts +1, total +1); keep the code pointer line accurate, naming `DashboardService.muscleGroupStats` and the `includeSecondary` parameter.

#### 2. Full suites

**Intent**: Catch regressions outside the stats page; no visual baseline is changed unless the new control legitimately moves the page, in which case the delta is explained first.

**Contract**: run the full backend and frontend suites. If `dashboard-ui.spec.ts` baselines for this page differ, the diff is reviewed and either explained or the layout adjusted; baselines are never refreshed without an explained visual delta (`CLAUDE.md`).

### Success Criteria:

#### Automated Verification:

- Full backend suite passes: `./mvnw test`
- Frontend build, lint, tokens and unit tests pass: `cd frontend && npm run build && npm run lint && npm run check:tokens && npm run test`
- Full e2e suite passes: `cd frontend && npm run test:e2e`

#### Manual Verification:

- README section 5 matches what the page does in both modes.
- `git status` shows only intended files changed and no baseline images modified without an explanation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `MuscleGroupParentTest`: every group has a parent, and the mapping equals the frontend hierarchy.
- Controller tests for the counting rules: primary only by default, secondary expansion, parent de-duplication, failure sets, window filter, other users' data, invalid parameter.

### Integration Tests:

- Playwright specs for the toggle in English and Polish, keyboard use, and parent versus sub-row numbers.

### Manual Testing Steps:

1. Log one overhead press and one bench press, open `/muscle-groups`, tick the box and compare Shoulders, Chest and Arms with and without it.
2. Expand a parent, tick and untick the box and confirm it stays expanded.
3. Check hover and keyboard focus on the checkbox, in dark mode too, and at phone width.

## Performance Considerations

All-time stats now load one aggregate row per exercise the user has trained plus those exercises' secondary muscles, which is a few dozen rows, instead of one row per muscle group. No new index is needed.

## Migration Notes

No database migration. API change is additive (`parents` field, optional `includeSecondary` parameter). The draft's two repository queries were never committed or deployed, so nothing needs to be kept for compatibility.

## References

- Change identity: `context/changes/secondary-muscle-stats/change.md`
- Brief: `context/changes/secondary-muscle-stats/plan-brief.md`
- Similar earlier work: `context/archive/2026-11-17-extend-muscle-groups/plan.md`, `context/changes/chest-regions/plan.md`
- Code: `DashboardService.java:170-192`, `WorkoutSetRepository.java:40-49`, `MuscleGroupStatsPage.tsx:83-93`, `muscleGroups.ts:29-36`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend counting by exercise and parent

#### Automated

- [x] 1.1 Stats controller tests pass: `./mvnw test -Dtest=MuscleGroupStatsControllerTest` — 56dceda
- [x] 1.2 Parent mapping test passes: `./mvnw test -Dtest=MuscleGroupParentTest` — 56dceda
- [x] 1.3 Full backend suite passes: `./mvnw test` — 56dceda

#### Manual

- [x] 1.4 With the `local` profile and Postgres up, `GET /api/dashboard/muscle-groups?includeSecondary=true` returns `parents` with six entries and the same `totalSets` as without the flag — 56dceda

### Phase 2: Frontend toggle and parent rows

#### Automated

- [x] 2.1 Type check and build pass: `cd frontend && npm run build`
- [x] 2.2 Lint passes: `cd frontend && npm run lint`
- [x] 2.3 Hard-coded value guard passes: `cd frontend && npm run check:tokens`
- [x] 2.4 Unit tests pass: `cd frontend && npm run test`
- [x] 2.5 Muscle stats e2e spec passes: `cd frontend && npx playwright test muscle-group-stats.spec.ts` (Postgres running, `CI` unset)

#### Manual

- [x] 2.6 In the browser the checkbox shows hover and a visible keyboard focus ring in light and dark themes
- [x] 2.7 Ticking the box on a user with mixed exercises changes sub-rows as expected, and Shoulders never exceeds the number of sets that touched shoulders
- [x] 2.8 The page still looks correct at phone width

### Phase 3: Docs and full verification

#### Automated

- [ ] 3.1 Full backend suite passes: `./mvnw test`
- [ ] 3.2 Frontend build, lint, tokens and unit tests pass: `cd frontend && npm run build && npm run lint && npm run check:tokens && npm run test`
- [ ] 3.3 Full e2e suite passes: `cd frontend && npm run test:e2e`

#### Manual

- [ ] 3.4 README section 5 matches what the page does in both modes
- [ ] 3.5 `git status` shows only intended files changed and no baseline images modified without an explanation
