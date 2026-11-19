---
change_id: bodyweight-and-timed-sets
title: Bodyweight and timed sets (per-exercise weight mode and measure)
status: implementing
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

Exercises get a `weightMode` (REQUIRED | OPTIONAL | NONE) and a `measure` (REPS | DURATION) so ab wheel rollout (no weight), pull-up / dip (reps + optional added weight) and plank (seconds + optional added weight) can be logged. Delivered in two stages: weight mode first (V16), duration measure second (V17).

Context: the weight step was changed from 0.5 to 0.25 kg (`QuarterKgStep`) just before this change was opened; that work is uncommitted on `main` and is the baseline for this plan.
