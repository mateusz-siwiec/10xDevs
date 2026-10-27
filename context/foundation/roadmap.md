---
project: "GymTrack"
version: 1
status: draft
created: 2026-10-21
updated: 2026-10-27
prd_version: 1
main_goal: learn
top_blocker: skills
milestone_id: first-usable-progression-loop
milestone_seq: 1
milestone_status: open
---

# Roadmap: GymTrack

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; the next milestone continues this file. Archive only when an independent roadmap replaces it.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First usable progression loop** — Status: open

- **Intent:** Prove that a logged-in user can run a real workout — start a session, log sets against seeded exercises, end it, and immediately see their own progression chart — while standing up the auth/catalog foundations and the core domain-rule slices (progression recommendation, exercise substitution) that make GymTrack's core value real, not just a note-taking app.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** PRD FR/US items as listed per slice, plus anchors added after the PRD (not covered by any FR):
  - MS-01: After logging in, the user sees a summary of their recent training — completed workouts, time spent and total volume (reps × kg).
  - MS-02: When starting a workout from a training plan, the user sees what they lifted per set in their previous workout from the same plan.
  - MS-03: The user can browse a paginated list of all their past workouts and open a compact view of how a given workout went.
  - MS-04: The user can correct a finished workout (its sets and its start/end time) and record a workout afterwards, with a date in the past.

## Vision recap

An amateur-to-intermediate gym-goer currently tracks workouts in scattered notes or a spreadsheet, with no real visibility into their own progression and no data-backed signal for what to do next. GymTrack's value isn't out-featuring existing tracking apps — it's full ownership of a transparent, deterministic recommendation rule the user understands and controls, plus the learning gained from building that domain rule end-to-end.

## North star

**S-01: core-workout-logging-loop — user can start a workout, log a set, and immediately see it on the progression chart.** This is the validation milestone for the `learn` goal: the "north star" here means the smallest end-to-end slice whose successful delivery proves the core product hypothesis (that transparent, per-set progression tracking is itself the value) — placed as early as Prerequisites allow because every other slice (recommendations, substitution, plan-driven work) only matters once this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | minimal-auth | (foundation) register, log in, log out; every request carries a scoped identity | — | FR-001, Access Control | done |
| F-02 | exercise-catalog-seed | (foundation) seeded exercise catalog with muscle-group tags exists and is queryable | — | FR-002, Access Control | done |
| S-01 | core-workout-logging-loop | start a session, select an exercise, log a set, end the session, see it on the progression chart | F-01, F-02 | US-01, FR-004, FR-005, FR-006, FR-010 | done |
| S-02 | user-defined-training-plan | define their own training plan as an ordered list of exercises | F-01, F-02 | FR-009 | done |
| S-03 | progression-recommendation | see a recommendation to increase weight after N full-rep workouts | S-01 | FR-011 | done |
| S-04 | exercise-substitution-suggestion | see a substitute exercise suggestion when marking one unavailable | S-01, F-02 | FR-012 | done |
| S-05 | custom-exercise-entry | add their own custom exercise with a muscle group | F-01, F-02 | FR-003 | proposed |
| S-06 | guided-session-navigation | navigate sequential exercises with skip/return and a rest timer | S-01 | FR-007, FR-008 | proposed |
| S-07 | plan-template-recommendation | receive a recommended plan template based on goal/experience/frequency | S-02 | FR-013 | blocked |
| S-08 | personal-record-flag | see a logged set flagged as a new personal record | S-01 | FR-014 | proposed |
| S-09 | return-after-break-suggestion | get an easier session suggested after a long gap | S-01 | FR-015 | proposed |
| S-10 | training-volume-balance-warning | get warned when weekly volume is imbalanced across muscle groups | S-01, F-02 | FR-016 | blocked |
| S-11 | workout-dashboard | see completed workouts, time spent and total volume for the last 7/30 days after logging in | S-01 | MS-01 | done |
| S-12 | previous-workout-weight-hint | see, per exercise and per set, what they lifted last time when starting a workout from the same plan | S-01, S-02 | MS-02 | proposed |
| S-13 | training-history | browse a paginated list of past workouts and open a compact view of each | S-01 | MS-03 | proposed |
| S-14 | training-session-editing | correct a finished workout's sets and times, and add a workout afterwards with a past date | S-13 | MS-04 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
| --- | --- | --- | --- |
| A | Identity & core logging loop | `F-01` → `S-01` → `S-03` → `S-06` → `S-08` → `S-09` → `S-11` → `S-12` | The `learn` goal's priority investment area (the domain rule) runs through this chain; `S-11` reads the same set history and has no dependency on the others, so it can run any time after `S-01`. `S-12` also needs `S-02` (joins Stream B) and is independent of the rest of the chain. |
| B | Catalog & planning | `F-02` → `S-02` → `S-05` → `S-07` | Joins Stream A at `S-01` (S-02 also needs F-01); `S-07` stays blocked pending the goal/experience/frequency capture gap. |
| C | Session resilience & balance | `S-04` → `S-10` | Joins Stream A at `S-01` and Stream B at `F-02`; `S-10` stays blocked pending an agreed balance standard. |
| D | Training history | `S-13` → `S-14` | Joins Stream A at `S-01`; `S-14` builds on the compact session view from `S-13` and reopens the "finished sessions are immutable" rule, so it is sequenced last. |

## Baseline

What's already in place in the codebase as of `2026-10-21` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** absent — only the default Vite+React scaffold, no routing, no product components (`frontend/src/App.tsx:1-138`).
- **Backend / API:** absent — only `GET /api/health`, no domain controllers (`HealthController.java`).
- **Data:** absent — PostgreSQL + JPA configured, but zero entities, repositories, or migrations.
- **Auth:** absent — no Spring Security, no provider integration, no middleware.
- **Deploy / infra:** partial — Fly.io deploy works (`Dockerfile` + `fly.toml`), but no CI/CD (`.github/workflows` doesn't exist).
- **Observability:** absent — only default SLF4J/Logback, no error tracking or metrics.

## Foundations

### F-01: Minimal auth

- **Outcome:** (foundation) users can register, log in, and log out; every API request carries a scoped identity so workout/plan/exercise data stays isolated per user.
- **Change ID:** minimal-auth
- **PRD refs:** FR-001, Access Control
- **Unlocks:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09, S-10
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Every downstream slice is blocked on this. Keep the scaffold minimal (e.g. email+password only first) so the "skills" risk budget (new frontend stack) is spent on the core domain rule, not on auth polish.
- **Status:** done

### F-02: Exercise catalog seed

- **Outcome:** (foundation) a predefined, seeded catalog of exercises exists, each tagged with a muscle group, queryable by the backend.
- **Change ID:** exercise-catalog-seed
- **PRD refs:** FR-002, Access Control
- **Unlocks:** S-01, S-02, S-04, S-05, S-10
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Seed data quality (muscle-group tagging) directly feeds FR-012's substitution suggestion and FR-016's imbalance warning — getting the tagging wrong propagates into two later slices.
- **Status:** done

## Slices

### S-01: Core workout logging loop

- **Outcome:** user can start a workout session, select a seeded exercise, log a set (reps + weight), end the session, and immediately see that set reflected on the exercise's progression chart.
- **Change ID:** core-workout-logging-loop
- **PRD refs:** US-01, FR-004, FR-005, FR-006, FR-010
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Every later recommendation/substitution rule reads from this slice's set history — any schema shortcut here (e.g. losing per-set granularity) blocks FR-011/FR-012 later. Keep sets as the source of truth and the chart as a view on top, per the PRD's own resolution on FR-010.
- **Status:** done

### S-02: User-defined training plan

- **Outcome:** user can define their own training plan as an ordered list of exercises from the catalog.
- **Change ID:** user-defined-training-plan
- **PRD refs:** FR-009
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD's own resolution on FR-009 says keep the plan format a plain ordered list with no imposed template — resist adding structure meant to pre-fit FR-013's future recommender.
- **Status:** done

### S-03: Progression recommendation

- **Outcome:** user sees a recommendation to increase weight for an exercise once they've completed all sets at full reps across the last N workouts of that exercise.
- **Change ID:** progression-recommendation
- **PRD refs:** FR-011
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - What is N (consecutive full-rep workouts) and the weight-increase percentage? — Owner: user. Block: no (PRD allows a reasonable tunable default).
- **Risk:** This is the "transparent, deterministic recommendation rule" the Vision names as the project's actual value — the agreed investment area, so it's worth the deepest implementation care of any slice here.
- **Status:** done

### S-04: Exercise substitution suggestion

- **Outcome:** user marks an exercise as skipped/unavailable during a session and sees a suggested substitute from the same muscle group.
- **Change ID:** exercise-substitution-suggestion
- **PRD refs:** FR-012
- **Prerequisites:** S-01, F-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Suggestion quality depends entirely on F-02's muscle-group tagging. Keep it framed as a suggestion the user can accept or ignore, not an automatic swap, per the PRD.
- **Status:** done

### S-05: Custom exercise entry

- **Outcome:** user can add their own custom exercise, including its muscle group.
- **Change ID:** custom-exercise-entry
- **PRD refs:** FR-003
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — a fast-follow once the predefined catalog proves insufficient; no need to build it ahead of real need.
- **Status:** proposed

### S-06: Guided session navigation

- **Outcome:** user experiences a full guided session — sequential exercise navigation with skip/return — and sees a countdown rest timer between sets.
- **Change ID:** guided-session-navigation
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD's own resolution on FR-007 names the exact risk: building a stateful session navigator before the core logging loop (S-01) is validated risks wasted effort — that's why this is sequenced after S-01.
- **Status:** proposed

### S-07: Plan-template recommendation

- **Outcome:** user receives a recommended training plan matched to a predefined template based on their goal, experience level, and training frequency.
- **Change ID:** plan-template-recommendation
- **PRD refs:** FR-013
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - The PRD never defines where or how a user's goal, experience level, and training frequency are captured — no profile or onboarding flow exists in any FR. — Owner: user. Block: yes.
- **Risk:** Cannot be planned until the capture mechanism for goal/experience/frequency is decided — this is a genuine PRD gap, not an implementation detail `/10x-plan` should paper over.
- **Status:** blocked

### S-08: Personal record flag

- **Outcome:** user sees a logged set flagged as a new personal record when it beats their estimated one-rep max for that exercise.
- **Change ID:** personal-record-flag
- **PRD refs:** FR-014
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD itself notes 1RM estimation formulas are inaccurate at high rep counts — document this as a known limitation when implemented, not a bug to fix.
- **Status:** proposed

### S-09: Return-after-break suggestion

- **Outcome:** user who returns after a gap longer than a configurable number of days is recommended an easier, warm-up-oriented session.
- **Change ID:** return-after-break-suggestion
- **PRD refs:** FR-015
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-08
- **Blockers:** —
- **Unknowns:**
  - What is the gap threshold (in days) that triggers this suggestion? — Owner: user. Block: no (nice-to-have, non-blocking per PRD).
- **Risk:** A fixed day-threshold can't distinguish a planned break from an accidental lapse (the PRD's own noted limitation) — document it as a heuristic, not a diagnosis.
- **Status:** proposed

### S-10: Training volume balance warning

- **Outcome:** user is warned when their weekly training volume is significantly imbalanced across muscle groups.
- **Change ID:** training-volume-balance-warning
- **PRD refs:** FR-016
- **Prerequisites:** S-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What counts as "significantly imbalanced"? The PRD has no agreed balance standard or threshold, and itself notes this risks encoding an arbitrary opinion that may not fit intentional specialization phases. — Owner: user. Block: yes.
- **Risk:** Cannot be planned responsibly until a balance standard is agreed — an opinionated default risks false warnings during legitimate specialization phases.
- **Status:** blocked

### S-11: Workout dashboard

- **Outcome:** user sees, right after logging in, how many workouts they completed, how much time they spent and their total volume (reps × kg) over the last 7 or 30 days.
- **Change ID:** workout-dashboard
- **PRD refs:** MS-01
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Not in the PRD — added to M-1 after the fact (MS-01), so it widens the milestone. It also takes over `/` from the workout screen, so links and the post-login landing change; only completed sessions count, so abandoned sessions stay invisible by design.
- **Status:** done

### S-12: Previous workout weight hint

- **Outcome:** user starting a workout from a training plan sees, for each exercise, what they lifted per set in their previous workout from the same plan.
- **Change ID:** previous-workout-weight-hint
- **PRD refs:** MS-02
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-05, S-06, S-08, S-09, S-13
- **Blockers:** —
- **Unknowns:**
  - Show the hint only, or also prefill the set logger with the previous weight? And how it sits next to the S-03 recommendation ("last time 60 kg" vs "try 61.5 kg"). — Owner: user. Block: no (decided in `/10x-plan`).
- **Risk:** "Previous workout of the same plan" depends on `session.planId`, which is cleared when a plan is deleted and does not snapshot targets, so the hint silently disappears for such sessions; keep it a hint, not a rule.
- **Status:** proposed

### S-13: Training history

- **Outcome:** user can browse a paginated list of all their past workouts (newest first) and open a compact view of how a given workout went.
- **Change ID:** training-history
- **PRD refs:** MS-03
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-08, S-09, S-12
- **Blockers:** —
- **Unknowns:**
  - Which summary fields the list shows and how large a page is. — Owner: user. Block: no (decided in `/10x-plan`).
- **Risk:** The list needs per-session aggregates (duration, set count, volume) in one query to avoid N+1; the compact per-exercise view built here is the shape `S-14` edits and `S-12` can reuse.
- **Status:** proposed

### S-14: Training session editing

- **Outcome:** user can correct a finished workout — its sets and its start/end time — and record a workout afterwards with a date in the past.
- **Change ID:** training-session-editing
- **PRD refs:** MS-04
- **Prerequisites:** S-13
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Edit scope: sets only, times only, or both; and whether adding a workout with a past date is part of this slice or separate. — Owner: user. Block: no (frame with `/10x-frame` before planning).
- **Risk:** Reopens the "finished sessions are immutable" rule (`WorkoutService` rejects set changes after `end`) and the PRD guardrail that a logged set is never silently overwritten; edits also re-judge dashboard totals and the S-03 recommendation. Keep every change explicit.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| F-01 | minimal-auth | Minimal auth: register, log in, log out | yes | Run `/10x-plan minimal-auth` |
| F-02 | exercise-catalog-seed | Seed predefined exercise catalog with muscle groups | yes | Run `/10x-plan exercise-catalog-seed` |
| S-01 | core-workout-logging-loop | Core workout logging loop + progression chart | no | Blocked on F-01, F-02 |
| S-02 | user-defined-training-plan | User-defined training plans | no | Blocked on F-01, F-02 |
| S-03 | progression-recommendation | Progression (increase-weight) recommendation | no | Blocked on S-01 |
| S-04 | exercise-substitution-suggestion | Exercise substitution suggestion | no | Blocked on S-01, F-02 |
| S-05 | custom-exercise-entry | Custom exercise entry | no | Blocked on F-01, F-02 |
| S-06 | guided-session-navigation | Guided session: skip/return + rest timer | no | Blocked on S-01 |
| S-07 | plan-template-recommendation | Plan-template recommendation | no | Blocked on S-02 + unresolved profile-capture gap |
| S-08 | personal-record-flag | Personal record flag | no | Blocked on S-01 |
| S-09 | return-after-break-suggestion | Return-after-break easier session | no | Blocked on S-01 |
| S-10 | training-volume-balance-warning | Training volume balance warning | no | Blocked on S-01, F-02 + unresolved balance standard |
| S-11 | workout-dashboard | Workout dashboard: workouts, time and volume for 7/30 days | yes | Planned — run `/10x-implement workout-dashboard phase 1` |
| S-12 | previous-workout-weight-hint | Previous workout weight hint when starting from a plan | yes | Run `/10x-plan previous-workout-weight-hint` |
| S-13 | training-history | Training history: paginated list + compact session view | yes | Run `/10x-plan training-history` |
| S-14 | training-session-editing | Edit finished sessions (sets, times) and add sessions retroactively | no | Blocked on S-13; frame with `/10x-frame` first |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog.

## Open Roadmap Questions

No roadmap-wide open questions at this milestone — both PRD `## Open Questions` map cleanly to a single slice each (see S-03's N/percentage unknown and S-09's gap-threshold unknown above).

## Parked

- **No offline support** — Why parked: PRD §Non-Goals — the product assumes a stable connection during a workout; no service worker or offline sync in the MVP.
- **No import of training plans from external files** — Why parked: PRD §Non-Goals — plans are entered manually inside the product.
- **No social features or plan/workout sharing** — Why parked: PRD §Non-Goals — the product is single-tenant per user in the MVP.
- **No personalization based on additional health signals (sleep, RPE, calories)** — Why parked: PRD §Non-Goals — the progression rule relies only on reps and weight.
- **CI/CD pipeline (GitHub Actions auto-deploy-on-merge)** — Why parked: `tech-stack.md` records this as the intended CI flow, but no slice needs it to ship the MVP core loop; manual `fly deploy` already works per `infrastructure.md`.

## Milestone History

(Empty — this is the first milestone.)

## Done

- **F-01: (foundation) users can register, log in, and log out; every API request carries a scoped identity so workout/plan/exercise data stays isolated per user.** — Archived 2026-10-22 → `context/archive/2026-10-21-minimal-auth/`. Lesson: —.
- **F-02: (foundation) a predefined, seeded catalog of exercises exists, each tagged with a muscle group, queryable by the backend.** — Archived 2026-10-22 → `context/archive/2026-10-22-exercise-catalog-seed/`. Lesson: —.
- **S-01: user can start a workout session, select a seeded exercise, log a set (reps + weight), end the session, and immediately see that set reflected on the exercise's progression chart.** — Archived 2026-10-26 → `context/archive/2026-10-22-core-workout-logging-loop/`. Lesson: —.
- **S-02: user can define their own training plan as an ordered list of exercises from the catalog.** — Archived 2026-10-26 → `context/archive/2026-10-26-user-defined-training-plan/`. Lesson: —.
- **S-04: user marks an exercise as skipped/unavailable during a session and sees a suggested substitute from the same muscle group.** — Archived 2026-10-27 → `context/archive/2026-10-27-exercise-substitution-suggestion/`. Lesson: —.
- **S-03: user sees a recommendation to increase weight for an exercise once they've completed all sets at full reps across the last N workouts of that exercise.** — Archived 2026-10-27 → `context/archive/2026-10-27-progression-recommendation/`. Lesson: —.
- **S-11: user sees, right after logging in, how many workouts they completed, how much time they spent and their total volume (reps × kg) over the last 7 or 30 days.** — Archived 2026-10-27 → `context/archive/2026-10-27-workout-dashboard/`. Lesson: —.
