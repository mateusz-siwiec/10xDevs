<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Extend muscle groups (split deltoids, adductors, abductors)

- **Plan**: context/changes/extend-muscle-groups/plan.md
- **Scope**: Full plan (5 of 5 phases)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-11-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (approved deviations: P2+P3 committed together, parent labels under `muscleStats.parent.*`, Phase 4 added after the first plan) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria were run at the end of Phase 5 on the same code (only docs and plan files changed afterwards): frontend build, lint (0 errors), unit tests (63), `check:tokens`, full e2e (77, no baseline changes) and full backend suite (226, 0 failures). All manual items (1.4, 3.4, 4.4, 5.4, 5.5) were confirmed by the user.

## Findings

### F1 — Expanding a parent re-announces the whole list to screen readers

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/MuscleGroupStatsPage.tsx (`<div aria-live="polite">` around `body`)
- **Detail**: The whole stats body, including the expandable sub-lists, sits inside the polite live region. Expanding or collapsing a parent changes nodes inside that region, so assistive technology may re-announce the list on every toggle. The region exists so loading, error and empty states are announced.
- **Fix A ⭐ Recommended**: Keep `aria-live` only on a small status element (loading / error / empty / total sets text) and render the list outside it.
  - Strength: Fixes the repeated announcements while keeping state changes announced.
  - Tradeoff: Slight restructuring of the page body; the e2e spec relies on the same elements, so it should keep working.
  - Confidence: MED — a standard pattern, but not tested with a real screen reader here.
  - Blind spot: Not verified with NVDA/VoiceOver.
- **Fix B**: Leave as is.
  - Strength: No change; the toggle already exposes `aria-expanded`.
  - Tradeoff: Possible noisy announcements.
  - Confidence: LOW — behaviour varies by screen reader.
  - Blind spot: Actual announcement behaviour not tested.
- **Decision**: FIXED via Fix A (aria-live now only on the status text; list rendered outside)

### F2 — Parent bar width can become NaN if the frontend and backend group lists drift

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/MuscleGroupStatsPage.tsx (`(parent.sets / max) * 100`)
- **Detail**: If the backend gained a group the frontend does not list, parent sums could be 0 while `totalSets > 0`, giving NaN%. Not reachable today (all 18 groups covered); the child division is already guarded.
- **Fix**: Use `max > 0 ? (parent.sets / max) * 100 : 0`.
- **Decision**: FIXED via Fix now (max > 0 guard)

### F3 — Planned toggle label key "Show {{name}} details" was not added

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md Phase 4 "Labels"; MuscleGroupStatsPage.tsx toggle button
- **Detail**: The plan asked for an accessible toggle label including the parent name. The button instead uses the visible parent name as its accessible name with `aria-expanded` for state. That is a sound pattern (the accessible name matches the visible text) and the e2e spec relies on it.
- **Fix**: Keep the code; record the deviation in the plan as an addendum (no code change).
- **Decision**: FIXED via Fix now (deviation recorded in follow-ups/review-fixes.md)

### F4 — Migration test duplicates the catalogue count and skips built-in remaps

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/test/java/com/example/gymtrack/exercise/SplitShouldersMigrationTest.java (hard-coded 48)
- **Detail**: The hard-coded catalogue count duplicates `ExerciseSeedTest` and will break whenever the catalogue grows, for a reason unrelated to this migration. Built-in slug remaps are covered only by `ExerciseSeedTest`.
- **Fix**: Drop the count assertion from the migration test (keep the owner_id null check if it is separate).
- **Decision**: FIXED via Fix now (count replaced by a check on the 8 new catalogue slugs)

### F5 — Polish wording for the delt heads and the Core parent

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: frontend/src/i18n/locales/pl.json (`muscle.FRONT_DELTS` / `SIDE_DELTS` / `REAR_DELTS`, `muscleStats.parent.CORE`)
- **Detail**: "Przednie/Boczne/Tylne aktony barków" uses "akton" (anatomical but gym-slang flavoured); "Core" is an anglicism whose children are the Polish "Brzuch" and "Mięśnie skośne". Both are valid but a native-speaker choice; the plan flagged Polish wording for the user's review.
- **Fix A ⭐ Recommended**: Ask the user for the final wording (e.g. "Przednia / Boczna / Tylna głowa barku" and "Brzuch i core") and change only those strings.
  - Strength: The user knows gym terminology; strings only, no logic.
  - Tradeoff: A short decision round.
  - Confidence: HIGH — nothing depends on the exact words except tests that read the JSON.
  - Blind spot: None significant.
- **Fix B**: Keep the current wording.
  - Strength: No change.
  - Tradeoff: Possibly less natural for some Polish readers.
  - Confidence: MED — "akton" is a real anatomical term.
  - Blind spot: User preference unknown.
- **Decision**: FIXED via Fix A (Przednia, Boczna, Tylna głowa barku; parent "Brzuch i core")

### F6 — V12 is lossy for custom exercises; production deploy needs a note

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/resources/db/migration/V12__split_shoulders_add_adductors_abductors.sql:37-48
- **Detail**: Custom exercises with primary Shoulders all become Side delts (and secondaries Front delts), so their historical set counts move to Side delts. The conversion is unavoidable but irreversible; Flyway applies it to the Supabase database at the next deploy. The plan's Migration Notes advise a backup first.
- **Fix**: State the lossy conversion and the backup advice in the PR description; no code change.
- **Decision**: FIXED via Fix now (release note recorded in follow-ups/review-fixes.md; include it in the PR description)
