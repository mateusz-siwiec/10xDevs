---
change_id: bodyweight-and-timed-sets
title: Bodyweight and timed sets (per-exercise weight mode and measure)
status: impl_reviewed
created: 2026-11-19
updated: 2026-11-20
archived_at: null
---

## Notes

Exercises get a `weightMode` (REQUIRED | OPTIONAL | NONE) and a `measure` (REPS | DURATION) so ab wheel rollout (no weight), pull-up / dip (reps + optional added weight) and plank (seconds + optional added weight) can be logged. Delivered in two stages: weight mode first (V16), duration measure second (V17).

Context: the weight step was changed from 0.5 to 0.25 kg (`QuarterKgStep`) just before this change was opened; that work was committed on its own (61b7b67) and is the baseline for this plan.

## Outcome (2026-11-20)

All six phases are implemented and verified (SHAs in plan.md Progress). The 0.25 kg step change was committed on its own (61b7b67). Two fixes found during manual checks were committed separately: 9ecf948 (progression chart skips legacy rep sessions for timed exercises) and 93d2668 (saved-workout prompt moved into a card, set logger inputs aligned).

Final gates: backend 285 tests, Playwright 109 tests, token guard and lint clean.

Follow-ups outside this change:
- The Arms parent row on the muscle stats page counts distinct sets, so it can be lower than the sum of its muscles when one set trains two of them (by design in secondary-muscle-stats). A clearer `noteSecondary` text in en/pl would explain it.
- `npm run test:e2e` cannot start the backend from the Git Bash tool shell (`mvnw.cmd` not recognised); start the backend and `npm run dev` first and run Playwright with `CI` unset. The local Postgres container is `10xdevs-postgres`.
- `context/changes/email-verification-and-password-reset/` is untracked and unrelated to this change.
