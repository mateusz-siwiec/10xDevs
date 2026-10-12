---
project: "GymTrack"
version: 1
status: draft
created: 2026-10-07
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

An amateur-to-intermediate gym-goer tracks workouts in scattered notes or a
spreadsheet, so they have no real visibility into their own progression over
time and no clear signal for what to do once a training plan is exhausted —
the cost today is either guessing at the next workout or stalling out on an
old plan with no data-backed way to decide the next step.

This is primarily an educational and personal-use project rather than an
attempt to out-feature existing tracking apps (Strong, Hevy, etc.): the value
is full ownership of a transparent, deterministic recommendation rule the
user understands and controls, plus the learning gained from shaping and
building a real domain rule end-to-end — not market novelty.

## User & Persona

**Primary persona**: Amateur-to-intermediate gym-goer who trains regularly
and already has some familiarity with training plans. They reach for the
product twice: during a gym session, to log sets in real time, and after
completing a training cycle, to decide what comes next.

## Success Criteria

### Primary
- A logged-in user can start a workout, pick an exercise from the catalog,
  log one set (reps + weight), and immediately see it reflected on a
  progression chart for that exercise.

### Secondary
- The first workout can be a full guided session (sequential exercises with
  skip/return, rest timer) rather than a single logged set.

### Guardrails
- One user's training data is never visible to another user.
- A logged set is never lost or silently overwritten.
- Logging a set during a session feels immediate — no noticeable lag that
  would interrupt a workout in progress.

## User Stories

### US-01: User logs a set and sees it on the progression chart

- **Given** a logged-in user with access to the exercise catalog
- **When** they start a workout, select an exercise, and log a set (reps + weight)
- **Then** they see that set reflected on the progression chart for that exercise

#### Acceptance Criteria
- The logged set persists immediately — no separate save step, no data loss.
- The progression chart updates without a page reload or extra user action.
- Logging the first-ever set for an exercise still renders a valid chart
  (single data point), not an error or blank state.

## Functional Requirements

### Access
- FR-001: User can register, log in, and log out. Priority: must-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written. Logout (originally its own
  > FR-002) was folded into this FR — trivial infrastructure, not a distinct
  > capability worth tracking separately.

### Exercise catalog
- FR-002: User can browse a predefined catalog of exercises. Priority: must-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written.
- FR-003: User can add their own custom exercise, including its muscle group. Priority: nice-to-have
  > Socrates: Counter-argument considered: "with a decent predefined
  > catalog, custom exercises are rarely needed in the MVP." Resolution:
  > downgraded from must-have to nice-to-have — predefined catalog covers
  > the primary flow, custom exercises become a fast-follow.

### Workout sessions
- FR-004: User can start a workout session and select an exercise to log. Priority: must-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written.
- FR-005: User can log a set (reps + weight) for the current exercise during an active session. Priority: must-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written.
- FR-006: User can end a workout session. Priority: must-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written.
- FR-007: User can navigate sequentially between exercises in a session, with the ability to skip an exercise and return to it later in the same session. Priority: nice-to-have
  > Socrates: Counter-argument considered: "building a stateful session
  > navigator before the core logging loop is validated risks wasted
  > effort." Resolution: kept as nice-to-have — reinforces building
  > FR-004/005/006 first and proving the core loop before this.
- FR-008: User sees a countdown rest timer between sets. Priority: nice-to-have
  > Socrates: Counter-argument considered: "no counter-argument; it stands
  > as written." Resolution: kept as written.

### Plans
- FR-009: User can define their own training plan as an ordered list of exercises. Priority: must-have
  > Socrates: Counter-argument considered: "plans defined before the
  > plan-template recommender exists (FR-013) may not match its expected
  > shape, risking rework." Resolution: kept; plan format stays a simple
  > ordered list of exercises with no imposed template structure, so it
  > remains forward-compatible with a future recommender.

### Visualization
- FR-010: User can view a progression chart (weight or volume over time) for a given exercise based on logged sets. Priority: must-have
  > Socrates: Counter-argument considered: "an aggregate chart might hide
  > the per-set signal FR-011's recommendation rule needs." Resolution:
  > kept; underlying data stays per-set, the chart is a view on top — not
  > the source of truth the recommendation rule reads from.

### Recommendation
- FR-011: System recommends increasing the weight for an exercise when the user has completed all sets at full reps in the last N workouts of that exercise. Priority: must-have
  > Socrates: Counter-argument considered: "a blanket rule ignores
  > recovery/injury context and could push an unprepared user into unsafe
  > progression." Resolution: kept; documented as an intentionally simple
  > heuristic, not a safety or recovery system — that nuance is out of
  > scope for MVP.
- FR-012: System suggests a substitute exercise from the same muscle group when the user marks an exercise as skipped/unavailable during a session. Priority: must-have
  > Socrates: Counter-argument considered: "muscle group alone ignores
  > equipment availability and movement pattern, so the suggestion may be
  > unhelpful." Resolution: kept; framed as a suggestion the user can
  > accept or ignore, not an automatic swap.

### Extended business rules
- FR-013: System recommends a new training plan matched to a predefined template based on the user's goal, experience level, and training frequency. Priority: nice-to-have
  > Socrates: Counter-argument considered: "a small set of templates may
  > not fit a user whose goal doesn't cleanly map to one, risking a
  > recommendation that often feels wrong." Resolution: kept as
  > nice-to-have — the counter-argument reinforces deferring this past
  > the MVP core loop.
- FR-014: System flags a logged set as a new personal record when it beats the user's estimated one-rep max for that exercise. Priority: nice-to-have
  > Socrates: Counter-argument considered: "1RM estimation formulas are
  > inaccurate at high rep counts." Resolution: kept as nice-to-have;
  > noted limitation — reliable mainly for lower-rep sets.
- FR-015: System recommends an easier, warm-up-oriented session when the user returns after a gap longer than a configurable number of days. Priority: nice-to-have
  > Socrates: Counter-argument considered: "a fixed day-threshold can't
  > distinguish a planned break from an accidental lapse." Resolution:
  > kept as nice-to-have; noted limitation.
- FR-016: System warns the user when weekly training volume is significantly imbalanced across muscle groups. Priority: nice-to-have
  > Socrates: Counter-argument considered: "without an agreed balance
  > standard, the warning encodes an arbitrary opinion that may not fit
  > intentional specialization phases." Resolution: kept as nice-to-have;
  > noted limitation.

## Non-Functional Requirements

- The product remains fully usable on a phone-sized touch screen — every
  logging interaction must be comfortably tappable mid-workout, not just
  viewable.
- Any user action receives visible acknowledgement within roughly one
  second, not just the set-logging action called out in the guardrails.
- A destructive action (deleting a workout or a plan) requires explicit
  confirmation before data is permanently removed.

## Business Logic

When a user has completed all sets at the target rep count across the last
N workouts of a given exercise, the app recommends increasing the working
weight by a set percentage; when an exercise is marked unavailable during a
session, the app suggests a substitute from the same muscle group.

The rule consumes the user's own logged history for an exercise (set-by-set
reps and weight over time) and, for substitution, the muscle group tag on
the skipped exercise. Its output is a suggested next weight (or percentage
increase) for the progression case, or a suggested alternative exercise name
for the substitution case — in both cases a suggestion, not an automatic
change. The user encounters it when starting a session or selecting an
exercise to log: the suggestion is shown alongside the logging UI, and the
user decides whether to accept, adjust, or ignore it.

## Access Control

Login (email+password / OAuth / passwordless). Flat role model — every
authenticated user manages only their own workouts, plans, and custom
exercises. No admin or trainer role in the MVP; the predefined exercise
catalog is shipped as read-only seed data, not managed through an in-product
role.

## Non-Goals

- No offline support — the product assumes a stable online connection during
  a workout; no service worker or offline sync in the MVP.
- No import of training plans from external files (PDF, other apps) —
  plans are entered manually inside the product.
- No social features or plan/workout sharing between users — the product is
  single-tenant per user in the MVP.
- No personalization based on additional health signals (sleep, RPE,
  calories) — the progression rule relies only on reps and weight.

## Open Questions

1. **What is N (number of consecutive full-rep workouts) and the weight-increase percentage for the progression rule (FR-011)?** — Owner: user. By: before implementation of FR-011. Block: no (MVP can ship with a reasonable default, tunable later).
2. **What is the gap threshold (in days) that triggers the "return after a break" suggestion (FR-015)?** — Owner: user. By: before implementation of FR-015 (nice-to-have, non-blocking for MVP).
