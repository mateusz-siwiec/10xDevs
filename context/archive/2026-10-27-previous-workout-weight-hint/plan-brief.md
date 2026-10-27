# Previous Workout Weight Hint — Plan Brief

> Full plan: `context/changes/previous-workout-weight-hint/plan.md`

## What & Why

When a user trains from a plan, GymTrack shows what they did for the selected exercise last time, per set (roadmap S-12, anchor MS-02). It saves digging through notes or the chart and anchors the next workout in the previous one.

## Starting Point

Sessions already store their plan (`planId`, nullable and cleared when the plan is deleted) and sets with reps and weight; warm-ups are ordinary sets. The S-03 recommendation panel shows a similar advisory line, and `WorkoutPage` already knows the active session's plan.

## Desired End State

During a plan workout, selecting an exercise shows e.g. "Last time (27 Oct): 5 × 40 kg, 10 × 60 kg, 10 × 60 kg, 10 × 60 kg" above the S-03 "Try X kg" line. Without a plan or history, nothing appears.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| What is "previous workout" | Latest ended session of the same plan that contains the exercise | A skipped exercise in the newest workout doesn't erase its hint. |
| Which sets | All sets of the exercise, in logged order, warm-ups included | Faithful "per set"; no unreliable warm-up detection. |
| Prefill | No — text hint only, `SetLogger` untouched | Smallest change; no risk of logging a stale weight by reflex. |
| Placement | Separate panel above the S-03 recommendation | Two independent deterministic facts side by side; S-03 untouched. |
| API | `GET /api/exercises/{id}/previous-workout?planId=`, 200 or 204 | Same shape as the S-03 endpoint; stateless and testable. |
| No plan / deleted plan | No hint | `planId` is the only link and is cleared on plan deletion. |

## Scope

**In scope:** previous-workout endpoint and tests, "Last time" panel on the workout page.

**Out of scope:** prefilling `SetLogger`, working-set filtering, hints for free-form sessions, schema changes, changes to S-03.

## Architecture / Approach

A new repository query finds the latest ended session of the plan with the exercise (newest first, deterministic tiebreaker); a read-only service loads that session's sets for the exercise; a small controller returns them or 204. The SPA fetches only when the session has a `planId` and renders a text panel inside a persistent `aria-live` region; errors render nothing.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend endpoint | Tested `previous-workout` lookup | Choosing the right session (skipping ones without the exercise, plan and user scoping) |
| 2. Frontend panel | "Last time" line under the picker | Stale response when exercise or plan changes |

**Prerequisites:** S-01 and S-02 (both done).
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- Deleting a plan clears `planId` on its sessions, so their history stops producing hints (accepted).
- Warm-ups appear in the line and can hide the working weight at a glance (accepted; revisit if it bothers).
- The hint may come from an older workout than the newest one of the plan; the date is shown to make that visible.

## Success Criteria (Summary)

- A second workout from a plan shows the previous workout's sets for each exercise.
- No hint for free-form workouts, new exercises, plans without history, or errors.
- Logging a workout is never blocked by the hint.
