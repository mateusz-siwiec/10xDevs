# Guided Session Navigation — Plan Brief

> Full plan: `context/changes/guided-session-navigation/plan.md`

## What & Why

Roadmap slice S-06 (PRD FR-007, FR-008): make a plan-driven workout a guided walkthrough where the user can skip an exercise and return to it later, and add a countdown rest timer between sets. Both are nice-to-have polish on the validated core logging loop (S-01), which is why they come after it.

## Starting Point

Plan sessions already auto-advance to the first entry below its set target and let the user tap any entry (`PlanWalkthrough`, `planProgress.ts`). There is no skip concept (S-04 and S-02 deferred it here) and no timer. Free-form sessions only have an exercise picker. The frontend has no test runner.

## Desired End State

In a plan session the user can press Skip on the current exercise; it is badged "Skipped", the next pending exercise is selected, and the skipped one is revisited by tapping it, by logging a set on it, or automatically once everything else is done. In every session, logging a set starts a rest countdown (default 90 s, adjustable, remembered per device) that can be extended or skipped and signals "Rest over" visually and by vibration.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Skip state storage | UI-only, in `WorkoutPage` state, keyed by entry position | Matches S-04's UI-only precedent and avoids a schema change for a nice-to-have; reload resets skips. |
| Free-form sessions | No navigation; rest timer only | A sequence only exists when a plan defines it. |
| Skip rules | Skip the selected entry (even with sets logged); return by tapping it or logging a set on it | Small rules that reuse the existing tap-to-select list. |
| End of plan | Auto-select first skipped entry plus a return hint | Makes "return later in the same session" happen without hunting. |
| Timer duration | Default 90 s, presets 60/90/120/180 s, stored in `localStorage` | Sensible out of the box, no backend, per-device preference. |
| Timer flow | Auto-start on successful set log; +30 s, Skip rest; visual + vibrate at zero | Zero extra taps mid-workout and no audio permission issues. |
| Timer accuracy | Store absolute end time, recompute from `Date.now()` | Stays correct when the tab is backgrounded or throttled. |
| Testing | Pure helpers in `planProgress.ts`; lint + build + manual | The repo has no frontend test runner and none is added. |

## Scope

**In scope:** skip-aware current/selected entry logic, Skip button and Skipped badge, return hint, rest timer with presets, +30 s and Skip rest, vibration at zero.

**Out of scope:** backend or storage persistence of skips, free-form navigation, Previous/Next buttons, per-entry rest targets, audio alerts, cross-device preference sync, a frontend test runner.

## Architecture / Approach

Frontend only. `planProgress.ts` gains a skip-aware `currentIndex` and a shared `selectedIndex`; `PlanWalkthrough` renders badges and the Skip button; `WorkoutPage` owns `skipped` (a set of entry positions) and the timer's `restEndsAt`, starting the timer in `handleLog` and clearing everything in `handleEnd`. A new `RestTimer` component counts down against an end timestamp.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Skip and return | Skip button, Skipped badge, skip-aware auto-selection and return hint in plan sessions | Selection logic is split between page and walkthrough; repeated exercises in a plan must target the right entry. |
| 2. Rest timer | Auto-starting countdown with presets, +30 s, Skip rest, vibrate | Timer drift and interval cleanup when the tab is backgrounded or the session ends. |

**Prerequisites:** S-01 and S-02 are done; no new dependencies.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Skips are lost on reload (accepted); users may see skipped entries as pending again.
- `navigator.vibrate` is unsupported on iOS Safari, so there the end of rest is visual only.
- A plan edited mid-session (positions renumbered) could mismatch skipped positions; unlikely, and the effect is only a stale badge.

## Success Criteria (Summary)

- A plan session supports skipping an exercise and returning to it, with the skipped exercise revisited automatically at the end.
- Every session shows a rest countdown after each logged set that can be extended, skipped and adjusted.
- Lint and build pass and the manual phone-width checks succeed.
