<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Upper, Mid and Lower Chest

- **Plan**: context/changes/chest-regions/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Success criteria evidence: every Automated command of Phases 1-4 was run during implementation on the final code (backend `./mvnw test` 236 tests / 0 failures / 1 skipped; frontend `npm run test` 65/65; `npm run build`; `npm run lint`; `npm run check:tokens`; `npm run test:e2e` 82/82 with no snapshot change; main bundle +0.30 kB gzipped vs. baseline 34b1e70). Only documentation commits (6ffe0f9, 4f50a77) landed after those runs, so they were not repeated in this review. All 8 Manual rows are ticked after explicit user confirmation in the session.

## Findings

### F1 — Plan does not record the approved deviations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/chest-regions/plan.md (Phase 2 and Phase 3 blocks)
- **Detail**: Three user-approved deviations exist only in the commit history and the session: (a) the i18n labels, the names and cues for decline-bench-press/chest-dip and the MuscleMap.test.tsx fixture moved from Phase 3 into Phase 2 (the Phase 1/2 unit suite was red without them); (b) four extra e2e specs (exercise-favorites, log-set, muscular-failure, progression-recommendation) changed the picker label to "Barbell Bench Press — Mid chest"; (c) CustomExerciseControllerTest catalogue sizes 48/49 became 50/51. The plan's Phase 3 block still lists the i18n work as Phase 3 scope, so a later reader or review will see drift.
- **Fix**: Add a short "Deviations from plan" note inside the Phase 2 and Phase 3 blocks of plan.md (Progress titles stay untouched).
- **Decision**: FIXED — notes added to the Phase 2 and Phase 3 Overview paragraphs of plan.md

### F2 — Stale comment above `belowThree` in ExerciseSeedTest

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/test/java/com/example/gymtrack/exercise/ExerciseSeedTest.java:47-50
- **Detail**: UPPER_CHEST (1 built-in) and LOWER_CHEST (2) were added to the "fewer than three primaries" exemption set, but the comment still says every other group has at least three exercises.
- **Fix**: Update the comment to mention the V14 chest regions.
- **Decision**: FIXED — comment updated in ExerciseSeedTest.java

### F3 — `GET /api/exercises?muscleGroup=CHEST` now returns 400

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseController.java:30
- **Detail**: The parameter binds to the enum, so the removed value is rejected. Nothing in frontend/src sends it (localStorage holds only the auth token, rest timer and language; URL params only the history page). A bookmarked URL, external client or cached old bundle sending CHEST would break; the plan already names this as an accepted contract break.
- **Fix**: Mention it in the release or PR notes; no code change.
- **Decision**: SKIPPED

### F4 — Custom incline/decline exercises migrate to Mid chest

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/resources/db/migration/V14__split_chest_into_regions.sql:7
- **Detail**: Every custom CHEST primary becomes MID_CHEST (decided in planning, mirrors V12's SHOULDERS to SIDE_DELTS). Users with custom incline or decline presses must re-categorise them by hand, and their historical sets show under Mid chest until then. V14 itself was checked as safe on Supabase: no lossy step, re-run safe, no slug collision possible with custom exercises, no other column stores group strings.
- **Fix**: Mention it in the release or PR notes; no code change.
- **Decision**: SKIPPED

### F5 — Test strength: geometry and new-exercise secondaries

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/src/components/MuscleFigure.test.tsx:80-96, src/test/java/com/example/gymtrack/exercise/SplitChestMigrationTest.java:56-64
- **Detail**: The figure tests count paths per region and check state mapping, so they would still pass if the three bands overlapped or left gaps; visual correctness rests on the approved preview (a programmatic raster check during this review found zero overlap and only rounding-level gaps). SplitChestMigrationTest does not assert the new exercises' secondaries, but ExerciseSeedTest.splitChestMigrationRetagsAndAddsCatalogExercises covers them.
- **Fix**: No change needed; optionally add one assertion on the new exercises' secondaries in SplitChestMigrationTest.
- **Decision**: SKIPPED

### F6 — Long Polish region labels

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/i18n/locales/pl.json (muscle.UPPER_CHEST, MID_CHEST, LOWER_CHEST)
- **Detail**: "Górna część klatki piersiowej" and "Środkowa część klatki piersiowej" are about 31 characters, longer than neighbours such as "Przednia głowa barku", and may wrap in narrow selects or chips. The user confirmed the screens in manual check 3.6, so this is cosmetic.
- **Fix**: Optionally shorten to "Górna klatka", "Środkowa klatka", "Dolna klatka".
- **Decision**: SKIPPED
