# Progression Recommendation — Plan Brief

> Full plan: `context/changes/progression-recommendation/plan.md`

## What & Why

GymTrack recommends raising the weight for an exercise once the user hit all working sets at full reps in their last two workouts of it (FR-011, roadmap S-03). This is the transparent, deterministic rule the Vision names as the project's actual value.

## Starting Point

Sets, ended sessions and plans all exist, but "full reps" has no target to compare against except the plan entry of the plan a session was started from. Sessions store only a nullable `planId`, and plans can be edited or deleted afterwards. The workout page already hosts the progression chart and the S-04 substitutes panel.

## Desired End State

When the user selects an exercise during a workout, a short sentence appears if the rule holds, e.g. "Try 61.5 kg — you completed 3×10 at 60 kg in your last 2 workouts." Otherwise nothing is shown.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Source of "full reps" | Target of the session's plan entry, read at evaluation time | Uses existing data with no migration. |
| Which workouts count | The 2 most recent ended sessions of the exercise; the running one is ignored | Consistent with the dashboard, no recommendation built on unfinished work. |
| Weight handling | Only working sets (the session's top weight); top weight equal across both sessions | Warm-ups don't block the rule and the suggestion is about a held weight. |
| N and increase | N = 2, +2.5%, rounded to 0.5 kg, at least +0.5 kg | Quick feedback loop; matches the 0.5 kg logging step; constants kept in one place. |
| Session without a target | Breaks the streak | Honest reading of "last N workouts of that exercise"; never skips an unverified workout. |
| Delivery | Text panel on `WorkoutPage`, 204 when nothing to recommend, no stored state | Smallest UI change, reuses the S-04 panel and `/current` 204 patterns. |

## Scope

**In scope:** recommendation endpoint and rule, tests, text panel on the workout page.

**Out of scope:** target snapshots/migration, free-form-session rule, "Use this weight" button, configurable N/%, deload or recovery logic, dashboard integration.

## Architecture / Approach

`GET /api/exercises/{id}/progression-recommendation` loads the 2 latest ended sessions with the exercise, resolves each session's plan target, isolates working sets, checks count and reps, requires the same top weight, and returns the increased weight or 204. The SPA fetches it per selected exercise and renders a sentence; errors are silent.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend rule and endpoint | Tested endpoint with the full rule | Edge cases: plan edit/deletion, warm-ups, rounding, ordering of sessions |
| 2. Frontend panel | Sentence under the exercise picker | Stale response when the selected exercise changes |

**Prerequisites:** S-01 and S-02 (both done).
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Targets are not snapshotted, so editing or deleting a plan changes how older sessions are judged; accepted and documented.
- Users who mostly train without a plan will rarely see a recommendation.
- 2 workouts and 2.5% are defaults per PRD Open Question 1; tune later.
- The rule is an intentionally simple heuristic, not a safety or recovery system (PRD).

## Success Criteria (Summary)

- After two qualifying workouts at the same weight the user sees the correct suggested weight.
- Any broken condition (target missing or missed, weight changed, running session) yields no suggestion.
- Logging a workout is never blocked by the panel.
