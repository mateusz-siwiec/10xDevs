# Track muscular failure on logged sets Implementation Plan

## Overview

Every logged set gets a yes/no "taken to muscular failure" flag. The user ticks a "To failure" checkbox when logging a set (it resets after each set). The flag is shown in the active workout's set list, in history detail and in the previous-workout hint, and the muscle stats page shows how many sets per muscle group went to failure. The weight-increase recommendation is deliberately unchanged.

## Current State Analysis

- A set (`WorkoutSet`, table `workout_sets`) holds session, exercise, reps, weight and `loggedAt` only. Sets are created and deleted but never edited (`WorkoutController`: `POST .../sets`, `DELETE .../sets/{setId}`), so the failure flag is chosen at logging time.
- `LogSetRequest` (`exerciseId`, `reps`, `weightKg`) is passed field by field through `WorkoutController.logSet` to `WorkoutService.logSet`, which builds `new WorkoutSet(session, exerciseId, reps, weightKg)` and returns `SetResponse` (with the personal-record flag). The 4-argument constructor is used widely in backend tests.
- Sets are read back in: `SetResponse` (active workout), `HistoryDetailResponse.SetEntry` built in `HistoryService` (~line 99), `PreviousWorkoutResponse.SetEntry` built in `PreviousWorkoutService` (~line 42), and the stats query `WorkoutSetRepository.countSetsByMuscleGroupBetween` returning `MuscleGroupCount(muscleGroup, sets)`, assembled by `DashboardService.muscleGroupStats` into `MuscleGroupStatsResponse.Group(muscleGroup, sets)`.
- Frontend: `SetLogger.tsx` (reps and weight inputs, values kept after logging, `onLog(reps, weightKg)`), `SessionSetList.tsx` (set lines with a PR badge), `HistoryDetailPage.tsx` (set lines via `history.detail.setLine`), `PreviousWorkoutHint.tsx` (`workout.setLine`), `MuscleGroupStatsPage.tsx` (flat parent rows with sub-rows, from the earlier muscle-groups change). Types live in `frontend/src/api/client.ts` (`WorkoutSet`, `LogSetInput`, `PreviousWorkout`, `HistoryDetail`, `MuscleGroupStats`).
- `ProgressionRecommendationService` uses only weight and reps. The PRD (§Non-Goals) and the roadmap park "personalization based on additional health signals (sleep, RPE, calories)", so the failure flag must not change the recommendation.
- Latest migration is `V12`; the next is `V13` (`CLAUDE.md`). Hibernate only validates the schema.

## Desired End State

- `workout_sets.to_failure` exists (boolean, not null, default false); old sets read as "not marked".
- The log form has a "To failure" checkbox that resets after each logged set; a set logged with it ticked is stored and returned with `toFailure: true`.
- The active workout's set list, history detail and the previous-workout hint mark sets taken to failure. The muscle stats page shows, per parent and per muscle, how many of its sets went to failure.
- The progression recommendation, personal records, volume and every other number are unchanged.

Verification: backend tests, Vitest, `npm run build` / `lint` / `check:tokens`, and Playwright specs; the workout screen's visual baselines change by the added checkbox and are refreshed with an explained delta.

### Key Discoveries:

- `src/main/java/com/example/gymtrack/workout/WorkoutService.java:106-119` - `logSet` is the single place sets are created; the `WorkoutSet` constructor and `LogSetRequest` are the contract to extend.
- `src/main/java/com/example/gymtrack/workout/WorkoutSetRepository.java:41-46` - the muscle stats query groups sets by primary muscle group; a conditional sum adds the failure count in the same query.
- `src/main/java/com/example/gymtrack/workout/HistoryService.java:99` and `PreviousWorkoutService.java:42` - the two read-back builders that need the extra field.
- `frontend/src/components/SetLogger.tsx:16-28` - values are intentionally kept after logging; the failure checkbox is the exception and resets.
- `frontend/src/components/SessionSetList.tsx:42-46` - the PR badge is the pattern for a per-set badge (`.pr-badge` in `frontend/src/styles/page.css`).
- `context/foundation/prd.md` §Non-Goals - failure data must stay out of the progression rule.

## What We're NOT Doing

- No RPE or reps-in-reserve scale; the flag is yes/no only.
- No effect on the weight-increase recommendation, personal records, volume or streaks, and no new README rule for them.
- No editing of existing sets and no "mark as failure afterwards" action (sets stay immutable).
- No dashboard home tile or period comparison for failure sets.
- No plan-level failure targets and no change to "save workout as plan".
- No backfill of old sets beyond the column default (false).
- No new design tokens.

## Implementation Approach

Backend first (one migration, optional request field defaulting to false, response fields, one extended query) so every UI phase has real data. Then the logging UX and the active set list, then the read-back surfaces (history, previous-workout hint, muscle stats), then docs, visual baselines and the full suites. `toFailure` is optional and defaults to false in the request, so existing clients and tests keep working; the 4-argument `WorkoutSet` constructor stays and a 5-argument one is added.

## Critical Implementation Details

- **Backward compatibility**: `toFailure` must default to `false` when absent from the request JSON (primitive `boolean` record component). Do not make it required, or every existing e2e/API caller and test that posts a set would fail validation.
- **Visual baselines**: the checkbox is a visible change on the workout screen (`workout-ui` screenshots). Refresh only the baselines for the platform you run on and explain the delta; never refresh without that.

## Phase 1: Backend data and API

### Overview

Store and return the flag, and count failure sets per muscle group.

### Changes Required:

#### 1. Migration V13

**File**: `src/main/resources/db/migration/V13__add_set_to_failure.sql`

**Intent**: Add the column with a default so existing sets read as "not marked".

**Contract**: `alter table workout_sets add column to_failure boolean not null default false;`. Never edit applied migrations.

#### 2. Entity, request and responses

**File**: `WorkoutSet.java`, `LogSetRequest.java`, `WorkoutController.java`, `WorkoutService.java`, `SetResponse.java`, `HistoryDetailResponse.java` (+ `HistoryService.java`), `PreviousWorkoutResponse.java` (+ `PreviousWorkoutService.java`), `SessionResponse.java` if it maps sets

**Intent**: Carry the flag from the request into the entity and out through every response that lists sets.

**Contract**: `WorkoutSet` gets `boolean toFailure` (column `to_failure`), a getter, and a 5-argument constructor; the 4-argument constructor stays and means `false`. `LogSetRequest` gains `boolean toFailure` (absent means false). `SetResponse`, `HistoryDetailResponse.SetEntry` and `PreviousWorkoutResponse.SetEntry` gain `boolean toFailure`. `WorkoutService.logSet` takes the flag and stores it.

#### 3. Muscle stats failure counts

**File**: `WorkoutSetRepository.java`, `MuscleGroupCount.java`, `MuscleGroupStatsResponse.java`, `DashboardService.java`

**Intent**: Extend the stats so each group also reports how many of its sets went to failure, over the same window.

**Contract**: `MuscleGroupCount(muscleGroup, sets, failureSets)` computed in the same grouped query (conditional count); `MuscleGroupStatsResponse.Group(muscleGroup, sets, failureSets)`; `failureSets <= sets`; groups with no sets report `0, 0`. The existing `sets` numbers and `totalSets` are unchanged.

#### 4. Backend tests

**File**: `src/test/java/com/example/gymtrack/workout/` (existing set, history, previous-workout and muscle stats tests; add cases)

**Intent**: Prove the flag round-trips and counts, and that old behaviour is untouched.

**Contract**: Logging with `toFailure: true` returns and persists true; omitting it gives false; history detail and previous-workout return the flag; muscle stats count failure sets per group and window (including sets from another user or an unfinished workout not counted); progression recommendation output is identical for failure and non-failure sets (guard test for the non-goal).

### Success Criteria:

#### Automated Verification:

- V13 applies on a fresh container and the workout tests pass: `./mvnw test -Dtest='WorkoutSetControllerTest,HistoryControllerTest,PreviousWorkoutControllerTest,MuscleGroupStatsControllerTest,ProgressionRecommendationControllerTest'`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the `local` profile running, `POST /api/workout-sessions/{id}/sets` with `toFailure: true` returns it, a request without the field returns `false`, and the stats endpoint shows `failureSets`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend foundation and logging

### Overview

Let the user log a set to failure and see it in the active workout.

### Changes Required:

#### 1. API client and strings

**File**: `frontend/src/api/client.ts`, `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Type the new field and add the UI text in both languages.

**Contract**: `WorkoutSet.toFailure: boolean`, `LogSetInput.toFailure?: boolean`, `PreviousWorkout.sets[].toFailure`, `HistoryDetail ... sets[].toFailure`, `MuscleGroupStats` groups gain `failureSets`. Keys (EN/PL, parity enforced by `locales.test.ts`): the checkbox label ("To failure" / "Do upadku"), the badge text and its accessible label ("Set taken to failure"), and the failure count text for the stats rows (e.g. "{{count}} to failure").

#### 2. Set logger checkbox

**File**: `frontend/src/components/SetLogger.tsx`, `frontend/src/pages/WorkoutPage.tsx` (the `handleLog` signature)

**Intent**: A labelled "To failure" checkbox next to reps and weight that is sent with the set and resets to unchecked after every successfully logged set; reps and weight keep their values as today.

**Contract**: `onLog(reps, weightKg, toFailure)`; the checkbox keeps its state when a log fails (so the user can retry), resets only on success; native checkbox with a visible label, 44px target, hover/focus-visible/disabled states, tokens only.

#### 3. Active set list badge

**File**: `frontend/src/components/SessionSetList.tsx`, `frontend/src/styles/page.css` or `workout.css`

**Intent**: Show a small "Failure" badge on sets taken to failure, like the PR badge.

**Contract**: Badge text plus `aria-label`/role like `.pr-badge` (not colour only); no change to the delete flow.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including locale parity: `cd frontend && npm test`
- Build, lint and token guard pass: `cd frontend && npm run build && npm run lint && npm run check:tokens`
- Log-set specs pass (existing and new failure case): `cd frontend && npm run test:e2e -- log-set`

#### Manual Verification:

- The checkbox looks right on the workout screen in light and dark, EN and PL, at phone width; ticking it, logging a set and seeing the badge works; the checkbox resets after logging while reps and weight stay.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Read-back surfaces

### Overview

Show the flag where past sets are read, and the failure counts on the stats page.

### Changes Required:

#### 1. History detail and previous-workout hint

**File**: `frontend/src/pages/HistoryDetailPage.tsx`, `frontend/src/components/PreviousWorkoutHint.tsx`

**Intent**: Mark sets taken to failure in the past-workout view and in the "last time" hint.

**Contract**: Reuse the same badge component or class as the active list so the marker looks the same everywhere; the set-line text and PR badge stay unchanged.

#### 2. Muscle stats failure counts

**File**: `frontend/src/pages/MuscleGroupStatsPage.tsx`, `frontend/src/styles/muscle-groups.css`

**Intent**: Each parent row and each expanded muscle also shows how many of its sets went to failure, over the selected window.

**Contract**: Parent failure count is the sum of its muscles' `failureSets`; shown as muted secondary text (e.g. "4 to failure") only when greater than 0, so rows without failure sets look as today; set counts, bars, sorting and the total line are unchanged.

#### 3. End-to-end specs

**File**: `frontend/e2e/log-set.spec.ts` (or a new `frontend/e2e/muscular-failure.spec.ts`), `frontend/e2e/muscle-group-stats.spec.ts`

**Intent**: Prove the user-visible behaviour.

**Contract**: Log one set with the checkbox ticked and one without; the badge appears only on the first; the checkbox is unchecked again after logging; after ending the workout the history detail shows the badge on the same set; starting the next workout from the same plan shows the marker in the previous-workout hint; the stats page shows the failure count on the parent and the muscle row and nothing for groups with none; an old-style set (logged via API without `toFailure`) shows no badge.

### Success Criteria:

#### Automated Verification:

- Build, lint, unit tests and token guard pass: `cd frontend && npm run build && npm run lint && npm test && npm run check:tokens`
- Specs pass: `cd frontend && npm run test:e2e -- log-set muscle-group-stats muscular-failure`

#### Manual Verification:

- The badge and the stats failure text look right in history, the hint and the stats page in EN and PL, light and dark, and at phone width.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Docs, baselines and full suites

### Overview

Document the feature, refresh the visual baselines for the added checkbox and run everything.

### Changes Required:

#### 1. Docs

**File**: `README.md`, `CLAUDE.md`

**Intent**: Mention failure tracking in the feature table and in "Sets per muscle group", state that it does not affect recommendations, and bump the next migration number.

**Contract**: Text edits only; `CLAUDE.md` "next is V13" becomes V14.

#### 2. Visual baselines

**File**: `frontend/e2e/workout-ui.spec.ts-snapshots/*` (platform you run on)

**Intent**: The workout screen gains a checkbox; refresh only the baselines it changes, with the delta explained in the commit.

**Contract**: Windows baselines refreshed locally; Linux baselines are regenerated on Linux/CI and called out in the PR description if not done here. No other baseline changes.

### Success Criteria:

#### Automated Verification:

- Build, lint, unit tests and token guard pass: `cd frontend && npm run build && npm run lint && npm test && npm run check:tokens`
- Full e2e suite passes: `cd frontend && npm run test:e2e`
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- Only the expected `workout-ui` baselines changed, and the added checkbox is the only visual delta.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before closing the change.

---

## Testing Strategy

### Unit Tests:

- Locale parity for the new strings; any pure helper for summing parent failure counts.

### Integration Tests:

- Backend: flag round trip (default false), history and previous-workout responses, muscle stats failure counts per group and window, recommendation unchanged for failure sets.
- Playwright: log with and without the checkbox, reset after logging, badge in the active list, in history and in the hint, stats page failure counts, old-style sets without a badge.

### Manual Testing Steps:

1. Start a workout from a plan, log a set with "To failure" ticked and one without; check the badge and the reset.
2. End the workout; open it in History; check the badge.
3. Start the next workout from the same plan; check the previous-workout hint.
4. Open "Sets per muscle group" and expand the parent of the trained muscle; check the failure count.
5. Repeat in Polish and at phone width.

## Performance Considerations

One boolean column and one conditional count in an existing grouped query; no new queries per request.

## Migration Notes

`V13__add_set_to_failure.sql` adds a non-null boolean with a default, so it is safe on populated tables and needs no backfill. Flyway applies it to the Supabase database on the next deploy; never edit it once applied. Rollback is dropping the column, which loses only failure flags.

## References

- Change identity: `context/changes/muscular-failure-tracking/change.md`
- Non-goal constraint: `context/foundation/prd.md` §Non-Goals, `context/foundation/roadmap.md`
- Similar implementation: `src/main/java/com/example/gymtrack/workout/WorkoutService.java:106` (set creation), `frontend/src/components/SessionSetList.tsx:42` (per-set badge)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend data and API

#### Automated

- [x] 1.1 V13 applies and the workout tests pass — 0c150cc
- [x] 1.2 Full backend suite passes — 0c150cc

#### Manual

- [x] 1.3 The API accepts, stores and returns the flag, defaults to false and shows failureSets in the stats — 0c150cc

### Phase 2: Frontend foundation and logging

#### Automated

- [x] 2.1 Unit tests pass, including locale parity — 624f46e
- [x] 2.2 Build, lint and token guard pass — 624f46e
- [x] 2.3 Log-set specs pass — 624f46e

#### Manual

- [x] 2.4 The checkbox looks right, logs the flag, shows the badge and resets after logging (EN/PL, light/dark, phone) — 624f46e

### Phase 3: Read-back surfaces

#### Automated

- [x] 3.1 Build, lint, unit tests and token guard pass — 3b6faec
- [x] 3.2 Failure, log-set and stats specs pass — 3b6faec

#### Manual

- [x] 3.3 The badge and the stats failure text look right in history, the hint and the stats page (EN/PL, light/dark, phone) — 3b6faec

### Phase 4: Docs, baselines and full suites

#### Automated

- [x] 4.1 Build, lint, unit tests and token guard pass
- [x] 4.2 Full e2e suite passes
- [x] 4.3 Full backend suite passes

#### Manual

- [x] 4.4 Only the expected workout-ui baselines changed and the checkbox is the only visual delta
