# Bodyweight and Timed Sets Implementation Plan

## Overview

Today every set needs reps and a weight above 0, so ab wheel rollouts, pull-ups at bodyweight and planks cannot be logged. This plan gives each exercise two settings: a `weightMode` (`REQUIRED`, `OPTIONAL`, `NONE`) and a `measure` (`REPS`, `DURATION`). It ships as one change in two stages: stage 1 adds weight mode (V16), stage 2 adds the duration measure (V17). "No weight" is stored as `0`, so `weight_kg` stays `NOT NULL` and volume maths keeps working.

## Current State Analysis

- `workout_sets.reps` and `weight_kg` are `NOT NULL`; checks are `reps between 1 and 100` and `weight_kg > 0 and <= 1000` (`V4__create_workout_sessions_and_sets.sql:14-21`, weight check at line 19). Hibernate runs in `validate` mode (`application.properties:7`), so entity and schema must change together.
- Built-in exercises have no flag column: they are rows with `owner_id is null` and a stable `slug` (`exercise/Exercise.java:49`, `ExerciseResponse.java:18`). Previous migrations backfill by slug (V3, V10, V12, V14, V15). `ExerciseSeedTest.java:39-40` asserts 50 built-ins.
- `WorkoutService.logSet` (`workout/WorkoutService.java:105-119`) only calls `existsVisible`; it never loads the exercise, so it cannot apply per-exercise rules.
- `LogSetRequest` requires `reps` (`@Min(1) @Max(100) int`) and `weightKg` (`@NotNull`, `@DecimalMin("0", inclusive=false)`, `@DecimalMax("1000")`, `@QuarterKgStep`) (`LogSetRequest.java:16-24`).
- Consumers that assume reps and weight exist: `PersonalRecordService` (`isEligible`, `score`, `MAX_ELIGIBLE_REPS = 15`), `WorkoutSetRepository` (`findProgression`, `sumVolumeBetween`, `aggregateBySession`, `findBestScoresBefore`, `findEligibleSetsOfEndedSessions`), `HistoryService.detail` (`:99-101`, multiplies weight by reps), `PreviousWorkoutService:42`, `ProgressionRecommendationService` (`:418-467`), `DashboardService`.
- Plan entries require `reps` (`V6__add_plan_entry_targets.sql`, `TrainingPlanEntry.java:36`, `PlanEntryRequest.java:21`).
- Frontend renders `reps × kg` in 8 places; e2e specs assert the exact string `8 × 60 kg` (`log-set.spec.ts`, `muscular-failure.spec.ts`, `delete-workout.spec.ts`, `save-workout-as-plan.spec.ts`, `progression-recommendation.spec.ts`).

## Desired End State

- A custom exercise can be created with any `measure` and `weightMode`; built-ins are backfilled by slug.
- Logging a set follows the exercise: ab wheel shows reps only; pull-up shows reps and an optional added-weight field; bench press behaves exactly as today; plank shows seconds and an optional weight field.
- Personal records, the progression chart, history, previous-workout hints and plan targets all make sense for every exercise kind. No endpoint throws on a set without weight or reps.
- Verify: full backend suite, frontend lint/build/token guard/unit tests and the Playwright suite pass, and a manual run through bench, pull-up, ab wheel and plank works in both languages.

### Key Discoveries:

- Weight is stored as `0` for "no weight"; only `reps` becomes nullable (stage 2). This avoids null handling in the volume sums (`WorkoutSetRepository` `sumVolumeBetween`/`aggregateBySession`) and `HistoryService.detail:101`.
- PR ranking can stay one rule: compare `(weight × (30 + reps), reps)` lexicographically for rep sets. Weighted sets keep today's order; bodyweight sets (score 0) fall through to reps. Duration sets rank by `(durationSeconds, weight)`.
- Existing test code constructs `new WorkoutSet(session, exerciseId, int reps, BigDecimal weightKg[, toFailure])` and `new Exercise(...)` in about 12 test classes. Keeping the old constructors as overloads avoids churn.
- The `locales.test.ts` seed regex (`insert into exercises ...;`) is unaffected by `UPDATE` backfills; no new built-in exercises are seeded.
- `check:tokens` scans a fixed `FILES` list in `frontend/scripts/check-hardcoded-values.mjs`; any new component that renders durations must be added to it.

## What We're NOT Doing

- No body-weight profile field and no bodyweight-adjusted scoring.
- No rest-timer, stopwatch or countdown for planks; seconds are typed in.
- No other change to the progression rule (+2.5 %, two qualifying sessions); suggestions are only skipped for non-weighted exercises, never re-based.
- No new built-in exercises (plank and copenhagen-plank already exist).
- No changing of measure/weight mode on an exercise that already has logged sets.
- No refresh of the Playwright visual baselines unless a visual delta is explained.

## Implementation Approach

Backend first, then frontend, per stage, so each phase is verifiable on its own. Stage 1 keeps `reps` and the plan targets untouched, which limits it to weight handling. Stage 2 makes `reps` nullable and adds duration to sets and plan entries. The API stays backward compatible: omitted `weightMode`/`measure` on create default to `REQUIRED`/`REPS`, and `weightKg` remains a number in every response.

Decisions taken during planning:

| Area | Decision |
| --- | --- |
| Ab wheel | `NONE` (field hidden) |
| PR ranking | per-exercise metric via the lexicographic key above |
| Duration plan targets | nullable `target_duration_seconds`, `reps` nullable, exactly one set |
| Changing measure/mode | rejected once any set references the exercise |
| Progression chart/suggestion | plot the exercise's metric; skip the suggestion at weight 0 or for DURATION |
| To-failure | stays available for every set, including duration |
| Progression step | rounding and the minimum increase move from 0.5 kg to 0.25 kg, matching the new weight step |
| Delivery | one change, two stages, six phases |

Backfill (V16/V17), by slug — to be confirmed in review: `NONE` = `ab-wheel-rollout`, `banded-lateral-walk`, `copenhagen-plank`; `OPTIONAL` = `pull-up`, `chest-dip`, `push-up`, `hanging-leg-raise`, `plank`; everything else `REQUIRED`. `DURATION` = `plank`, `copenhagen-plank`; everything else `REPS`.

## Phase 1: Weight mode on exercises (backend)

### Overview

Introduce `weightMode` on exercises, relax the stored set weight to allow 0, backfill built-ins, and guard edits once sets exist.

### Changes Required:

#### 1. Migration V16

**File**: `src/main/resources/db/migration/V16__add_exercise_weight_mode.sql`

**Intent**: Add the exercise weight mode, allow weight 0 on sets, and classify the built-ins.

**Contract**: `exercises.weight_mode varchar(16) not null default 'REQUIRED'` with a check on the three values; `workout_sets` weight check replaced by `weight_kg >= 0 and weight_kg <= 1000` (drop the old unnamed check by its generated name, as `V13` shows the pattern for altering this table); `UPDATE exercises SET weight_mode = ... WHERE slug IN (...)` per the backfill list above. Never edit applied migrations.

#### 2. Exercise entity, enum and DTOs

**Files**: `src/main/java/com/example/gymtrack/exercise/Exercise.java`, new `WeightMode.java`, `CreateExerciseRequest.java`, `ExerciseResponse.java`, `ExerciseService.java`

**Intent**: Persist and expose the weight mode; accept it on create and update, defaulting to `REQUIRED` when omitted; reject changing it once a set references the exercise.

**Contract**: `enum WeightMode { REQUIRED, OPTIONAL, NONE }` stored as `@Enumerated(STRING)`; `Exercise` constructor and `update(...)` gain the field, keeping the old constructor as an overload for existing tests; `ExerciseResponse.weightMode`; in `ExerciseService.update` (`:91-108`) a changed `weightMode` with `workoutSetRepository.existsByExerciseId` true returns 409 using the existing in-use error code if one exists, otherwise a new `ErrorCode` entry.

#### 3. Tests

**Files**: `ExerciseSeedTest`, `CustomExerciseControllerTest`, `WorkoutSchemaTest`

**Intent**: Prove the backfill, the create/update round trip, the default, the edit lock, and that the schema accepts weight 0 and still rejects negative or above 1000.

**Contract**: seed test asserts the weight mode of each backfilled slug; schema test inserts a weight-0 set through raw SQL (`insertSet`, `WorkoutSchemaTest:58-60`).

### Success Criteria:

#### Automated Verification:

- Exercise and schema tests pass: `./mvnw test -Dtest=ExerciseSeedTest,CustomExerciseControllerTest,WorkoutSchemaTest`
- Full backend suite passes with V16 applied by Flyway: `./mvnw test`

#### Manual Verification:

- Creating a custom exercise with `weightMode: OPTIONAL` via the API returns it in the response, and changing it after logging a set returns 409.

---

## Phase 2: Weight-aware logging and stats (backend)

### Overview

Make logging, personal records, progression and the chart respect the weight mode.

### Changes Required:

#### 1. Logging validation

**Files**: `workout/LogSetRequest.java`, `workout/WorkoutService.java` (`logSet`), `workout/WorkoutController.java:51-57`

**Intent**: Load the exercise when logging and enforce its weight mode: `REQUIRED` needs a positive weight, `OPTIONAL` treats a missing weight as 0, `NONE` rejects a positive weight and stores 0.

**Contract**: `LogSetRequest.weightKg` becomes optional with `@DecimalMin("0")` inclusive (the `@QuarterKgStep` validator already accepts null); `logSet` uses `findVisibleById` instead of `existsVisible` and throws the existing `VALIDATION_FAILED` 400 (field `weightKg`) on a violated mode; the stored value is always a `BigDecimal`, 0 when not given. The old `WorkoutSet` constructor stays; `SetResponse.weightKg` remains a number.

#### 2. Personal records

**Files**: `workout/PersonalRecordService.java`, `workout/WorkoutSetRepository.java` (`findBestScoresBefore`, `findEligibleSetsOfEndedSessions`)

**Intent**: Rank rep sets by `(weight × (30 + reps), reps)`, apply the 15-rep cap only to weighted sets, and make bodyweight sets (weight 0) eligible.

**Contract**: a weight-0 set is eligible at any rep count up to the existing 100 limit and ranks by reps; weighted sets are unchanged, so every existing PR test result stays identical. The best-score query must compare the pair, not just the score, so either extend the JPQL or move the pair comparison into the service.

#### 3. Progression suggestion and chart

**Files**: `workout/ProgressionRecommendationService.java`, `workout/ProgressionPointResponse.java`, `workout/WorkoutSetRepository.java` (`findProgression`), the progression controller/service that serves the chart

**Intent**: Skip the weight suggestion for `NONE` exercises and whenever the top weight is 0; make the chart value follow the exercise's metric.

**Contract**: recommendation returns empty when the exercise's weight mode is `NONE` or the sessions' top weight is 0 (it must load the exercise, which `:398` currently does not). The same method also moves the step to 0.25 kg: `MIN_STEP` (`:29`) becomes `0.25` and `recommendedWeight` (`:113-121`) rounds half up to the nearest 0.25 kg (scale 2) with the result at least one 0.25 kg step above the top weight. Worked results: 5 kg gives 5.25, 10 kg gives 10.25, 60 kg gives 61.5, 100 kg gives 102.5, and 2 kg hits the floor at 2.25 (2.05 would round down to 2.0). `ProgressionRecommendationControllerTest.roundingBoundaries` (`:192-208`) and its comments are updated accordingly, with a 2 kg floor case added. The README rule text and examples (`README.md:41-42, 52, 72-73`) change to 0.25 kg in Phase 6. Progression points are additive: add `metric` (`WEIGHT` or `REPS`) and `value`, keep `topWeightKg`. Metric is `WEIGHT` for `REQUIRED`, `REPS` for `NONE`, and for `OPTIONAL` `WEIGHT` when the series has any positive weight, else `REPS`.

#### 4. Tests

**Files**: `WorkoutSetControllerTest`, `PersonalRecordControllerTest`, `ProgressionRecommendationControllerTest`, `ProgressionControllerTest`, `DashboardInsightsControllerTest`

**Intent**: Cover each weight mode at the API, bodyweight PRs by reps, weighted-over-bodyweight ordering, suggestion skipped at weight 0, and the chart metric.

**Contract**: the existing `logSetWithInvalidValues…` cases change only where a weight of `0` becomes valid for non-`REQUIRED` exercises; a `REQUIRED` exercise still rejects 0.

### Success Criteria:

#### Automated Verification:

- Workout, PR and progression tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest,PersonalRecordControllerTest,ProgressionRecommendationControllerTest,ProgressionControllerTest,DashboardInsightsControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Logging an empty-weight pull-up set and an ab wheel set via the API succeeds, a positive weight on the ab wheel is rejected, and the dashboard records and chart JSON show reps for them.

---

## Phase 3: Weight mode UI (frontend)

### Overview

Expose the weight mode in the exercise form and logger, with shared set formatting and per-metric labels. Output for rep-based `REQUIRED` exercises stays identical.

### Changes Required:

#### 1. API types and client

**File**: `frontend/src/api/client.ts`

**Intent**: Add the weight mode to exercise types and make set input and progression types match the backend.

**Contract**: `export type WeightMode = 'REQUIRED' | 'OPTIONAL' | 'NONE'`; `Exercise.weightMode` (`:136-144`), `CreateExerciseInput.weightMode` (`:182-186`), `LogSetInput.weightKg` optional (`:164-169`), progression point `metric` and `value`.

#### 2. Exercise form

**File**: `frontend/src/pages/ExerciseFormPage.tsx`

**Intent**: Add a weight-mode control to create and edit, defaulting to `REQUIRED`, disabled with an explanatory note when the backend would reject the change.

**Contract**: follow the existing `exercise-secondary` fieldset pattern (`exercises.css`) or a `workout-select`; hover, focus-visible and disabled states required; state loads from `found` and goes into `payload` (`:32-34`, `:48-50`, `:80-84`).

#### 3. Set logger and workout page

**Files**: `frontend/src/components/SetLogger.tsx`, `frontend/src/pages/WorkoutPage.tsx` (`handleLog` `:181-186`, `SetLogger` use `:364`)

**Intent**: Show the weight field as required, optional or hidden per the selected exercise; send no weight when hidden or empty.

**Contract**: `SetLogger` receives the selected `Exercise` (from `selectedItem`, `:99`); for `REQUIRED` the markup, labels and the `set-weight` id stay as today; for `OPTIONAL` the label reads "Added weight (kg), optional" and the field is not `required`; for `NONE` the field is not rendered. The kept-between-sets values reset when the exercise changes.

#### 4. Formatting and display sites

**Files**: `frontend/src/utils/format.ts` (new `formatSet`), `components/SessionSetList.tsx:42`, `components/PreviousWorkoutHint.tsx:60`, `pages/HistoryDetailPage.tsx:122`, `components/RecentRecords.tsx:35`, `components/ProgressionChart.tsx:75-88`, `components/ProgressionRecommendation.tsx`

**Intent**: One formatter for a set line, per-metric chart unit, reps-only record text, and no suggestion for exercises without one.

**Contract**: `formatSet({reps, weightKg})` returns `8 × 60 kg` when weight > 0 and `8 reps` (localised) when 0; the dashboard mask text `65 kg x 8 · Oct 30` in `dashboard-ui.spec.ts:84-86` must be unchanged for weighted sets.

#### 5. i18n

**Files**: `frontend/src/i18n/locales/en.json`, `pl.json`

**Intent**: Strings for the weight-mode control and options, the optional label, reps-only set lines and the reps chart label.

**Contract**: identical key sets in en and pl (parity test `locales.test.ts:25-40`); any plural keys include every `Intl.PluralRules` category per language (`:42-57`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint` (from `frontend/`)
- Build and typecheck pass: `npm run build`
- Token guard passes: `npm run check:tokens`
- Unit tests pass: `npx vitest run`
- Existing Playwright specs pass unchanged: `npm run test:e2e`

#### Manual Verification:

- Bench press logs exactly as before; pull-up shows the optional weight field; ab wheel shows no weight field; the form's weight-mode control works in light and dark themes, in English and Polish.
- No visual baseline needed refreshing.

---

## Phase 4: Duration measure (backend)

### Overview

Add the `measure` setting and duration sets, nullable reps, and duration targets in plans, with all consumers updated.

### Changes Required:

#### 1. Migration V17

**File**: `src/main/resources/db/migration/V17__add_duration_measure.sql`

**Intent**: Store duration on sets and plan entries and classify the built-in timed exercises.

**Contract**: `exercises.measure varchar(16) not null default 'REPS'` with a value check, backfill `plank` and `copenhagen-plank` to `DURATION`; `workout_sets.reps` nullable, `duration_seconds integer`, checks `reps between 1 and 100` and `duration_seconds between 1 and 3600` (null-tolerant) plus a row check that exactly one of `reps`/`duration_seconds` is set; `training_plan_entries.reps` nullable, `target_duration_seconds integer` with the same range and exactly-one row check.

#### 2. Entities, enum, DTOs

**Files**: `exercise/Exercise.java`, new `Measure.java`, `CreateExerciseRequest.java`, `ExerciseResponse.java`, `ExerciseService.java`, `workout/WorkoutSet.java`, `LogSetRequest.java`, `SetResponse.java`, `plan/TrainingPlanEntry.java`, `PlanEntryRequest.java`, `PlanEntryInput.java`, `PlanEntryResponse.java`, `PlanResponse.java`, `TrainingPlan.java`

**Intent**: Carry measure on exercises and duration on sets and plan entries; the edit lock now covers measure as well.

**Contract**: `enum Measure { REPS, DURATION }`; `WorkoutSet.reps` becomes `Integer`, new `Integer durationSeconds`; `LogSetRequest.reps` becomes `Integer`, new `durationSeconds`; plan entries get `targetDurationSeconds` with `reps` nullable. Old primitive-`int` constructors stay as overloads.

#### 3. Logging and plan validation

**Files**: `workout/WorkoutService.java`, `plan/TrainingPlanService.java`

**Intent**: Enforce measure per exercise: `REPS` needs reps and rejects duration; `DURATION` needs duration and rejects reps; plan entries follow the same rule.

**Contract**: violations return `VALIDATION_FAILED` with the offending field (`reps` or `durationSeconds`); the exercise is already loaded from Phase 2.

#### 4. Consumers

**Files**: `workout/HistoryService.java:88-109`, `HistoryDetailResponse.java:14`, `PreviousWorkoutService.java:42`, `PreviousWorkoutResponse.java:10`, `PersonalRecordService.java`, `PersonalRecordEntry.java:8`, `DashboardInsightsResponse.java`, `DashboardService.java`, `WorkoutSetRepository.java`, `ProgressionRecommendationService.java`, the progression point service

**Intent**: No consumer throws on a duration set; PRs rank duration sets by longest time; the chart plots seconds; volume ignores duration sets; progression suggestions are skipped for `DURATION` exercises.

**Contract**: response `SetEntry` records gain `durationSeconds` and `reps` becomes `Integer`; `HistoryService.detail` skips volume for sets with null reps; repository queries filter on `reps is not null` where they multiply or compare reps; PR key for `DURATION` is `(durationSeconds, weight)`; progression metric `DURATION` added to the Phase 2 enum.

#### 5. Tests

**Files**: `WorkoutSetControllerTest`, `WorkoutSchemaTest`, `TrainingPlanControllerTest`, `TrainingPlanSchemaTest`, `HistoryControllerTest`, `PreviousWorkoutControllerTest`, `PersonalRecordControllerTest`, `ProgressionControllerTest`, `ProgressionRecommendationControllerTest`, `ExerciseSeedTest`, `CustomExerciseControllerTest`

**Intent**: Cover duration logging, the exactly-one rule at API and schema level, a duration plan entry, history and previous-workout shape, PR by duration, and the measure edit lock.

**Contract**: the 500-class regression to guard against is a duration set (null reps) flowing through history, volume, PR and recommendation code.

### Success Criteria:

#### Automated Verification:

- Schema tests pass: `./mvnw test -Dtest=WorkoutSchemaTest,TrainingPlanSchemaTest,ExerciseSeedTest`
- Duration-related controller tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest,TrainingPlanControllerTest,HistoryControllerTest,PreviousWorkoutControllerTest,PersonalRecordControllerTest,ProgressionControllerTest,ProgressionRecommendationControllerTest`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- A plank set (seconds, no reps) logs via the API; the session, history detail, previous workout, records and chart endpoints all return 200 with sensible values.

---

## Phase 5: Duration UI and plans (frontend)

### Overview

Add the measure control, the seconds input, duration targets in the plan editor and walkthrough, and duration formatting everywhere sets are shown.

### Changes Required:

#### 1. API types

**File**: `frontend/src/api/client.ts`

**Intent**: Reflect measure and duration across exercise, set, plan, history, previous-workout and record types.

**Contract**: `Measure = 'REPS' | 'DURATION'`; `Exercise.measure`; `WorkoutSet.reps: number | null`, `durationSeconds: number | null`; `LogSetInput` optional `reps`/`durationSeconds`; `PlanEntry`/`PlanEntryInput` `reps` nullable plus `targetDurationSeconds`; history set entries, previous-workout sets and `RecentPersonalRecord` gain `durationSeconds`.

#### 2. Exercise form and logger

**Files**: `pages/ExerciseFormPage.tsx`, `components/SetLogger.tsx`, `pages/WorkoutPage.tsx`

**Intent**: A measure control next to weight mode; the logger shows a seconds input for `DURATION` instead of reps.

**Contract**: duration input is a whole number of seconds (1-3600) with an inline unit label; hover, focus-visible and disabled states; `handleEnd` (`WorkoutPage.tsx:160`) maps sets to the save-as-plan summary and must tolerate null reps; the "to failure" checkbox stays.

#### 3. Plans

**Files**: `components/PlanExerciseList.tsx`, `pages/PlanEditorPage.tsx`, `components/PlanWalkthrough.tsx:47`, `components/planProgress.ts`, `utils/workoutToPlan.ts` (+ test)

**Intent**: Plan entries for `DURATION` exercises edit and show seconds targets; saving a workout as a plan produces duration targets for timed exercises.

**Contract**: the target field switches by the entry's exercise measure (`PlanTargetField`, `PlanExerciseList.tsx:14`); defaults per measure (`PlanEditorPage.tsx:82`); `MIN/MAX` bounds in `workoutToPlan.ts:5-7` get duration equivalents; walkthrough renders `3 × 45 s`.

#### 4. Formatting, charts, i18n

**Files**: `utils/format.ts` (`formatDuration`, `formatSet` extended), `components/ProgressionChart.tsx`, `components/RecentRecords.tsx`, `components/SessionSetList.tsx`, `components/PreviousWorkoutHint.tsx`, `pages/HistoryDetailPage.tsx`, `locales/en.json`, `pl.json`, `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Seconds display everywhere sets appear, a seconds chart unit, and the token guard covering any new component.

**Contract**: `formatDuration(90)` yields `1:30` style or `90 s` — pick one and use it everywhere; locale key parity as in Phase 3; any new component rendering durations is added to `FILES` (`check-hardcoded-values.mjs:8-28`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Token guard passes: `npm run check:tokens`
- Unit tests pass: `npx vitest run`
- Existing Playwright specs pass: `npm run test:e2e`

#### Manual Verification:

- Plank: log a 45 s set with and without added weight, see it in the session list, history and previous-workout hint; the chart shows seconds.
- A plan with a plank entry shows a seconds target in the editor and the walkthrough; saving a workout with a plank as a plan creates a seconds target.

---

## Phase 6: End-to-end coverage and docs

### Overview

Lock the behaviour with Playwright specs and update the documentation.

### Changes Required:

#### 1. E2E specs and helper

**Files**: `frontend/e2e/helpers.ts`, new `frontend/e2e/bodyweight-sets.spec.ts`, new `frontend/e2e/timed-sets.spec.ts`

**Intent**: Cover the new flows through the UI and API.

**Contract**: helper creates an exercise via API with a given `measure` and `weightMode`; specs cover an ab wheel set (no weight field), an optional-weight pull-up with an empty and a filled weight, a plank set with seconds, a plank plan entry through the walkthrough, and the form's edit lock message.

#### 2. Docs

**Files**: `README.md` (set weight rule at `:185`, progression rule at `:41-73`), `context/foundation/test-plan.md`

**Intent**: Document weight modes, measures, the per-exercise PR rule and the skipped suggestions.

**Contract**: the "Set weight" row notes it is required, optional or absent depending on the exercise; the progression section states the suggestion only applies to weighted rep exercises and uses 0.25 kg rounding and a 0.25 kg minimum increase (`README.md:41-42, 52, 72-73`, plus the progression-example table).

### Success Criteria:

#### Automated Verification:

- New and existing e2e pass: `npm run test:e2e`
- Full backend suite passes: `./mvnw test`
- Token guard and lint pass: `npm run check:tokens` and `npm run lint`

#### Manual Verification:

- A full pass through bench press, pull-up, ab wheel and plank: log, view history and dashboard, build and run a plan.
- README and test plan read correctly and match the behaviour.

---

## Testing Strategy

### Unit Tests:

- `formatSet` and `formatDuration`; `workoutToPlan` with timed sets; locale parity and plural coverage.
- Weight-mode and measure validation matrix in `WorkoutSetControllerTest` (4 modes x present/absent/zero/positive).

### Integration Tests:

- Flyway V16 and V17 on Testcontainers Postgres, schema checks for weight 0, reps/duration exactly-one and plan entry exactly-one.
- PR ordering: weighted over bodyweight, bodyweight by reps, duration by seconds then weight.
- Every read endpoint (history, previous workout, records, progression, dashboard) with a duration set present.

### Manual Testing Steps:

1. Create a custom exercise per mode/measure combination and log a set for each.
2. Try to change weight mode or measure after logging; expect the 409 message.
3. Check the dashboard records and the progression chart for each exercise kind.
4. Switch the language to Polish and repeat the form and logger checks.

## Performance Considerations

None expected. The PR query change adds one tie-break column; the data volume is small per user.

## Migration Notes

V16 and V17 only add columns with defaults and relax checks, so existing rows stay valid with no data rewrite; the backfill is slug-based and idempotent. Flyway applies them to the Supabase DB on the next deploy; never run them from a local profile pointed at that database. After V17 existing sets keep `reps` set and `duration_seconds` null, which satisfies the exactly-one check.

## References

- Weight step change this builds on: `src/main/java/com/example/gymtrack/workout/QuarterKgStep.java` (uncommitted baseline)
- Set schema: `src/main/resources/db/migration/V4__create_workout_sessions_and_sets.sql:14-21`
- Logging: `src/main/java/com/example/gymtrack/workout/WorkoutService.java:105-119`, `LogSetRequest.java:11-33`
- PR rules: `src/main/java/com/example/gymtrack/workout/PersonalRecordService.java`
- Progression: `src/main/java/com/example/gymtrack/workout/ProgressionRecommendationService.java:398-467`
- Logger UI: `frontend/src/components/SetLogger.tsx`
- Token guard: `frontend/scripts/check-hardcoded-values.mjs:8-28`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Weight mode on exercises (backend)

#### Automated

- [x] 1.1 Exercise and schema tests pass: `./mvnw test -Dtest=ExerciseSeedTest,CustomExerciseControllerTest,WorkoutSchemaTest` — d6a9ed4
- [x] 1.2 Full backend suite passes with V16 applied by Flyway: `./mvnw test` — d6a9ed4

#### Manual

- [x] 1.3 Custom exercise with `weightMode: OPTIONAL` round-trips via the API and changing it after logging a set returns 409 — d6a9ed4

### Phase 2: Weight-aware logging and stats (backend)

#### Automated

- [x] 2.1 Workout, PR and progression tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest,PersonalRecordControllerTest,ProgressionRecommendationControllerTest,ProgressionControllerTest,DashboardInsightsControllerTest` — 4cc51f2
- [x] 2.2 Full backend suite passes: `./mvnw test` — 4cc51f2

#### Manual

- [x] 2.3 Empty-weight pull-up and ab wheel sets log via the API, a positive weight on the ab wheel is rejected, and records and chart JSON show reps — 4cc51f2

### Phase 3: Weight mode UI (frontend)

#### Automated

- [x] 3.1 Lint passes: `npm run lint`
- [x] 3.2 Build and typecheck pass: `npm run build`
- [x] 3.3 Token guard passes: `npm run check:tokens`
- [x] 3.4 Unit tests pass: `npx vitest run`
- [x] 3.5 Existing Playwright specs pass unchanged: `npm run test:e2e`

#### Manual

- [x] 3.6 Bench press logs as before, pull-up shows the optional weight field, ab wheel shows none, and the form control works in light/dark and en/pl
- [x] 3.7 No visual baseline needed refreshing

### Phase 4: Duration measure (backend)

#### Automated

- [ ] 4.1 Schema tests pass: `./mvnw test -Dtest=WorkoutSchemaTest,TrainingPlanSchemaTest,ExerciseSeedTest`
- [ ] 4.2 Duration-related controller tests pass: `./mvnw test -Dtest=WorkoutSetControllerTest,TrainingPlanControllerTest,HistoryControllerTest,PreviousWorkoutControllerTest,PersonalRecordControllerTest,ProgressionControllerTest,ProgressionRecommendationControllerTest`
- [ ] 4.3 Full backend suite passes: `./mvnw test`

#### Manual

- [ ] 4.4 A plank set logs via the API and session, history, previous workout, records and chart endpoints all return 200 with sensible values

### Phase 5: Duration UI and plans (frontend)

#### Automated

- [ ] 5.1 Lint passes: `npm run lint`
- [ ] 5.2 Build passes: `npm run build`
- [ ] 5.3 Token guard passes: `npm run check:tokens`
- [ ] 5.4 Unit tests pass: `npx vitest run`
- [ ] 5.5 Existing Playwright specs pass: `npm run test:e2e`

#### Manual

- [ ] 5.6 Plank sets log with and without added weight and appear in session list, history, previous-workout hint and chart (seconds)
- [ ] 5.7 A plan with a plank entry shows a seconds target in the editor and walkthrough, and saving a workout with a plank as a plan creates a seconds target

### Phase 6: End-to-end coverage and docs

#### Automated

- [ ] 6.1 New and existing e2e pass: `npm run test:e2e`
- [ ] 6.2 Full backend suite passes: `./mvnw test`
- [ ] 6.3 Token guard and lint pass: `npm run check:tokens` and `npm run lint`

#### Manual

- [ ] 6.4 Full pass through bench press, pull-up, ab wheel and plank: log, history, dashboard, plan
- [ ] 6.5 README and test plan match the behaviour
