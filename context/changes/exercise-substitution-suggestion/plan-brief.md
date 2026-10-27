# Exercise Substitution Suggestion — Plan Brief

> Full plan: `context/changes/exercise-substitution-suggestion/plan.md`

## What & Why

When an exercise is unavailable mid-workout, GymTrack suggests a substitute from the same muscle group (FR-012, roadmap S-04). It keeps the session moving while the user stays in control: it is a suggestion to accept or ignore, never an automatic swap.

## Starting Point

The seeded catalog tags every exercise with a primary muscle group (4 per group), and the repository already queries by that group. The workout page selects an exercise and logs sets against it, but has no notion of "unavailable".

## Desired End State

In an active session, pressing "Unavailable" shows up to three same-group alternatives ordered by name. "Use this" switches the logger and progression chart to the chosen substitute. Nothing is stored, so reloading clears it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where the rule lives | Backend `GET /api/exercises/{id}/substitutes` | Server-owned, testable domain rule matching the project's endpoint pattern. |
| Is "unavailable" stored | No, UI-only | Avoids schema work that overlaps S-06's skip/return state. |
| Which candidates, what order | All other exercises in the same primary group, by name; UI shows 3 | Deterministic and explainable, with no invented heuristics. |
| What "accept" does | Switches the logging target only | Smallest change; reuses existing selection logic and leaves plan progress untouched. |

## Scope

**In scope:** substitutes endpoint + tests; Unavailable button, suggestions panel, accept/dismiss.

**Out of scope:** persistence, plan-entry remapping, equipment/history ranking, secondary groups, automatic swaps.

## Architecture / Approach

A stateless endpoint resolves the exercise (404 if unknown) and returns same-primary-group exercises minus itself, ordered by name. The workout page keeps a small local "panel open for exercise X" state and renders suggestions only while X is still the selected exercise.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend endpoint | Tested `GET /api/exercises/{id}/substitutes` | Low; reuses an existing repository query pattern |
| 2. Frontend UI | Unavailable button, suggestions panel, accept/dismiss | Stale panel state when the selected exercise changes |

**Prerequisites:** S-01 and F-02 (both done).
**Estimated effort:** ~1-2 sessions across 2 phases.

## Open Risks & Assumptions

- Muscle group alone ignores equipment and movement pattern, so some suggestions may be unhelpful (accepted in the PRD).
- In plan sessions the skipped entry stays pending after a substitution; sets logged against the substitute do not count toward it.
- The "3 suggestions" cap is a UI choice and could be tuned later.

## Success Criteria (Summary)

- A user can mark an exercise unavailable and get same-group alternatives in one tap.
- Accepting a suggestion lets the user log sets for it immediately.
- Backend tests cover the rule; frontend lint and build pass.
