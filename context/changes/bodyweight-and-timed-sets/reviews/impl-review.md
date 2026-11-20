<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Bodyweight and Timed Sets

- **Plan**: context/changes/bodyweight-and-timed-sets/plan.md
- **Scope**: Full plan (6 of 6 phases)
- **Reviewed phases**: 1, 2, 3, 4, 5, 6
- **Date**: 2026-11-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Success criteria (re-run for this review)

- Backend `./mvnw test`: PASS, 285 tests, 0 failures, 1 skipped (existing skip).
- Frontend `npm run lint`: PASS (0 errors, existing AuthContext warnings), `npm run build`: PASS, `npm run check:tokens`: PASS, `npx vitest run`: PASS (68 tests).
- Playwright `npm run test:e2e`: not re-run for this review (needs the dev servers). Last run at af2e8b5: 109 passed; no application code has changed since, only plan/change docs.
- Manual rows: all `[x]` in Progress, each confirmed by the user during the phase gates.

## Findings

### F1 — Legacy Plank data breaks after V17 turns Plank into a timed exercise

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/main/resources/db/migration/V17__add_duration_measure.sql:5, frontend/src/pages/PlanEditorPage.tsx:52, frontend/src/utils/workoutToPlan.ts:36, src/main/java/com/example/gymtrack/workout/PersonalRecordService.java:49
- **Detail**: V17 flips `plank` and `copenhagen-plank` to DURATION but leaves their existing rep sets and plan entries in place (verified in code). (1) Plan editor: an entry's measure is derived from `targetDurationSeconds != null`, so a legacy Plank entry with `reps` loads as a REPS entry; saving sends `reps` and the backend rejects it with 400 `RepsNotAllowed`, so the user cannot save that plan without deleting and re-adding the exercise. (2) "Save as plan" decides rep vs duration from the logged set data, not from the exercise's measure, so a past workout holding legacy Plank rep sets cannot be saved as a plan. (3) Personal records merge rep ranks (weight x (30 + reps)) and duration ranks (seconds) into one rank per exercise, so a legacy weighted Plank rep set with a score around 800 would permanently beat every duration PR (800 > 60 s). Weight-0 legacy sets score 0 and are not affected. The progression chart already skips legacy sessions (9ecf948).
- **Fix A ⭐ Recommended**: Add a V18 migration that converts legacy Plank and Copenhagen Plank plan entries to a duration target (reps -> `target_duration_seconds`, defaulting to 30 s), derive the measure from the exercise in `PlanEditorPage` and `workoutToPlan` instead of from the entry or set data, and keep rep ranks and duration ranks as separate groups in `PersonalRecordService`.
  - Strength: Fixes the data at its source for every user and makes the frontend independent of the stored entry shape; V16/V17 stay untouched.
  - Tradeoff: A new migration plus three touch points; mapping reps to seconds is arbitrary, so converted targets need a glance.
  - Confidence: MED — the failing paths are confirmed in code, but nobody has run them against real legacy data.
  - Blind spot: How many production plans actually contain Plank entries, and whether any have a weighted Plank history.
- **Fix B**: Frontend-only: derive the measure from the exercise, show a legacy reps entry as a seconds field prefilled with 30 s, and fix the PR namespaces in the service; no migration.
  - Strength: No schema change and no data rewrite.
  - Tradeoff: Rows stay in the legacy shape until a plan is re-saved, and the backend still rejects the old shape if any other client sends it.
  - Confidence: MED — smaller change, but the stale rows keep existing.
  - Blind spot: Other places that read plan entries by shape, such as an old walkthrough session.
- **Decision**: FIXED via Fix A — V18 converts legacy timed plan entries to a 30 s target (with LegacyTimedPlanEntriesMigrationTest), PlanEditorPage and workoutToPlan take the measure from the exercise (+2 vitest cases), PersonalRecordService keeps rep and duration ranks in separate groups (+ legacyWeightedRepSetsNeverBlockDurationRecords). Verified: backend 287, Playwright 109, vitest 70.

### F2 — The edit lock ignores plan entries

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseService.java:100
- **Detail**: Changing `weightMode` or `measure` is only blocked when sets exist (`workoutSetRepository.existsByExerciseId`). An exercise that sits in a plan but has no sets can still be switched between REPS and DURATION, which leaves its plan entries in the wrong shape (the same breakage as F1, created through the UI). `planRepository.existsEntryByExerciseId` already exists and is used by the delete check at line 129.
- **Fix**: Also reject measure changes when `planRepository.existsEntryByExerciseId(id)` is true (weight mode does not affect plan entries, so it can stay set-only), with a message that mentions plans.
  - Strength: One extra existing query and keeps plan entries consistent with their exercise.
  - Tradeoff: A custom exercise used only in a plan can no longer change measure until it is removed from the plan.
  - Confidence: HIGH — same pattern already used for deleting an exercise.
  - Blind spot: The frontend message `exercises.settingsInUse` mentions sets only.
- **Decision**: FIXED via Fix now — a measure change is also refused while a plan entry uses the exercise (weight mode stays set-only); en/pl message and the two e2e assertions now mention plans; test updateChangingMeasureIsConflictWhileAPlanUsesTheExerciseButWeightModeIsNot (red when the plan check is removed). The edit-lock race from the reviewer notes was left as is (small window, own exercise).

### F3 — Personal-record queries now load one row per earlier set

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java:59 (findBestScoresBefore), :79 (findBestDurationScoresBefore), src/main/java/com/example/gymtrack/workout/PersonalRecordService.java:49
- **Detail**: Both baseline queries lost their `group by`/`max`, so every earlier eligible set of the exercise is returned and reduced in Java. They run on every set log and every history detail view, so the cost grows with a user's history. The plan expected small data and allowed comparing in the service, so this is acceptable today but an unbounded load.
- **Fix**: Group in the query: for rep sets `group by exerciseId, reps` with `max(weightKg)` (at most 100 rows per exercise), for duration sets `group by exerciseId, durationSeconds` with `max(weightKg)`, and let the service pick the best pair.
  - Strength: Bounds the row count by distinct reps or seconds, not by history length, and keeps the (score, reps) rule unchanged.
  - Tradeoff: Slightly more JPQL and the existing PR tests need to keep passing as the guard.
  - Confidence: MED — the shape is simple but the tie-break must stay identical.
  - Blind spot: No measurement of actual query time on a large history.
- **Decision**: FIXED via Fix now — both baseline queries group by exercise and rep count (or duration) with the max weight; behaviour unchanged. Test earlierBaselineIsTheHeaviestSetOfEachRepCountAndDuration (red with min instead of max); existing PR, history and dashboard tests pass.

### F4 — New validation rules have no Polish (or English) translation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/i18n/locales/en.json, pl.json (`validation.*`), frontend/src/i18n/locales.test.ts:132
- **Detail**: The backend emits the rules `RepsNotAllowed`, `DurationNotAllowed` and `WeightNotAllowed`, and a REQUIRED exercise with weight 0 returns `DecimalMin` without a `min`. None of the new rules are in the locale files or in the rule list of `locales.test.ts`, so `translateError` falls back to the English server message and a Polish user sees English. The UI hides those fields, so this is mostly reachable through a stale form or the F1 plan-save failure.
- **Fix**: Add the three keys to both locale files and to the rule list in `locales.test.ts`, and make the `DecimalMin` text work without a `min`.
- **Decision**: FIXED via Fix — en/pl texts for WeightRequired, WeightNotAllowed, RepsNotAllowed and DurationNotAllowed, added to the locale test rule list. The REQUIRED-without-weight case now emits its own rule WeightRequired instead of DecimalMin without a limit. Tests: requiredExerciseRejectsZeroAndMissingWeight asserts the rule (red when reverted); the locale tests go red when a key is missing.

### F5 — Form lock feedback comes after submit, and one plan detail was renamed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/pages/ExerciseFormPage.tsx:173-203, plan.md Phase 3 item 2 and Phase 5 item 4
- **Detail**: The plan says the weight-mode control is "disabled with an explanatory note when the backend would reject the change". As built, both selects are only disabled while saving and the lock appears as a message after a 409, because the exercise API does not expose whether sets exist. The plan also names the formatter `formatDuration`; the code uses `formatSeconds` because `formatDuration` already exists in `utils/format.ts` for session length.
- **Fix**: Record both as accepted in the plan (a later `inUse` flag on the exercise response could enable the proactive note).
- **Decision**: FIXED via Fix now — both points recorded as accepted deviations in plan.md ("Accepted deviations" section); no code change.

### F6 — Duplicate exception types and small code nits

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/main/java/com/example/gymtrack/workout/InvalidSetWeightException.java, src/main/java/com/example/gymtrack/common/InvalidFieldException.java, src/main/java/com/example/gymtrack/exercise/Exercise.java, frontend/src/components/SetLogger.tsx, frontend/src/components/RecentRecords.tsx:21
- **Detail**: `InvalidSetWeightException` is `InvalidFieldException` with the field fixed to `weightKg`, and the reps-versus-duration check is duplicated between `WorkoutService` and `TrainingPlanService` with different field names. `Exercise.java` has a typo `this.id =UUID.randomUUID();`. In `SetLogger` only the duration input is `disabled` while submitting (reps and weight are not), which drops keyboard focus after each logged timed set; the reps input also lacks `min`/`max` while duration has them. `RecentRecords` hard-codes `" kg x "`, with a different separator from `formatSet`.
- **Fix**: Replace `InvalidSetWeightException` with `InvalidFieldException` (field `weightKg`), fix the typo, make the three `SetLogger` inputs behave the same, and use the localised formatter in `RecentRecords` (the last one was inherited and could be a follow-up).
- **Decision**: FIXED via Fix now — InvalidSetWeightException merged into InvalidFieldException (field weightKg, handler removed), typo fixed in Exercise.java, SetLogger duration input no longer disabled while submitting, reps input has min 1 / max 100. RecentRecords hard-coded " kg x " left as a follow-up (inherited). Guarded by requiredExerciseRejectsZeroAndMissingWeight and the Playwright suite.

### F7 — The progression chart metric can flip for optional-weight exercises

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/workout/WorkoutService.java:193-197
- **Detail**: For an OPTIONAL exercise the chart plots reps while every session has weight 0 and switches to weight as soon as one weighted set exists, so the axis, unit and label change suddenly. This was a deliberate plan decision, but it can surprise the user the first time they add weight.
- **Fix**: Leave as is, or always plot reps for OPTIONAL exercises and show weight separately; no action needed unless it confuses users.
- **Decision**: SKIPPED — keep the planned behaviour (an optional-weight chart plots reps until weight appears); revisit if it confuses users.
