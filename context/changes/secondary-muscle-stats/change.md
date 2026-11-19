---
change_id: secondary-muscle-stats
title: Include secondary muscles toggle on muscle group stats
status: implemented
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

add an "include secondary muscles" toggle to the per-muscle-group stats page (/muscle-groups) and GET /api/dashboard/muscle-groups

Context: a first draft was already implemented on branch feat/chest-regions before this change was opened (uncommitted): `includeSecondary` query param on the endpoint, `countSetsBySecondaryMuscleGroupBetween` in `WorkoutSetRepository`, merge in `DashboardService.muscleGroupStats`, checkbox in `MuscleGroupStatsPage.tsx`, en/pl strings, one backend test. Treat it as a draft for the plan to confirm or revise. Open design questions: parent-row double counting, meaning of the total line, checkbox vs segmented control, persistence, full vs fractional weighting of secondary sets.
