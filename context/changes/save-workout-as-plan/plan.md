# Save workout as plan Implementation Plan

## Overview

Add a "Save as plan" action that turns a completed workout into a training plan via the existing `POST /api/training-plans`. It is offered on the history detail page and right after ending a workout. No backend changes.

## Current State Analysis

- `TrainingPlanController` already exposes `POST /api/training-plans`; `PlanRequest` takes `name` (max 60) and 1–50 entries of `{exerciseId, sets 1–20, reps 1–100}`. Frontend wrapper: `createPlan` in `frontend/src/api/client.ts:422`.
- A plan entry has one `sets` and one `reps` per exercise and no weight; a workout logs individual sets with reps and weight.
- `HistoryDetailPage` loads a finished workout grouped by exercise (`exercises: {exerciseId, sets[]}[]`, `client.ts:484`) and already has an actions row; it works for any past workout.
- `WorkoutPage.handleEnd` (`WorkoutPage.tsx:133`) clears the session immediately; there is no post-workout screen. The live `session.sets` is a flat ordered list of `SetResponse`.
- Frontend tests use vitest (`npm test`); e2e specs live in `frontend/e2e/` and use helpers in `e2e/helpers.ts`. UI strings are in `frontend/src/i18n/locales`, with a `locales.test.ts` parity check.

## Desired End State

From a finished workout (history detail, or immediately after "End workout") the user can open an inline form with a prefilled, editable name, confirm, and get a new plan in `/plans` whose entries mirror the workout order with sets and most-common reps. Verified by unit tests on the mapping and an e2e spec for both entry points.

### Key Discoveries:

- Backend contract already fits; the only gap is mapping sets to `{sets, reps}` (`PlanRequest.java`, `PlanEntryRequest.java`).
- `HistoryDetailPage.tsx:136` actions row is the integration point for the history entry point.
- `WorkoutPage.tsx:133-149` is where the ended session is dropped; the ended sets must be captured before `setSession(null)`.

## What We're NOT Doing

- No new backend endpoint, migration or weight/target storage in plans.
- No merging of repeated exercises, and no editing of entries before saving (use the plan editor afterwards).
- No new full summary page after a workout; only a lightweight panel.
- No duplicate-plan detection.

## Implementation Approach

A pure mapping function plus one shared component, reused by both entry points. The component owns name state, the `createPlan` call, and success/error display, so each page only supplies the sets and a default name.

## Phase 1: Mapping util

### Overview

Pure, unit-tested conversion of a workout's ordered sets into plan entries.

### Changes Required:

#### 1. Mapping function

**File**: `frontend/src/utils/workoutToPlan.ts` (+ `workoutToPlan.test.ts`)

**Intent**: Convert a list of `{exerciseId, reps}` in workout order into `PlanEntryInput[]`, one entry per consecutive run of the same exercise (a repeat later in the workout stays a separate entry).

**Contract**: `workoutToPlanEntries(sets: {exerciseId: string; reps: number}[]): PlanEntryInput[]`. `sets` = run length capped at 20; `reps` = most frequent rep count in the run (ties → higher value), clamped to 1–100; at most 50 entries (first 50 kept); empty input → `[]`. Also export `defaultPlanName(sourcePlanName: string | null, startedAt: string): string` returning the source plan name or a formatted date, trimmed to 60 characters.

### Success Criteria:

#### Automated Verification:

- Mapping tests pass (grouping, repeat exercise stays separate, most-common reps with tie → higher, 20-set cap, 50-entry cap, empty input, name truncation): `cd frontend && npm test`
- Type checking and build pass: `cd frontend && npm run build`
- Linting passes: `cd frontend && npm run lint`

#### Manual Verification:

- Reading the util and tests, the behavior matches the agreed rules.

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Save-as-plan component and history integration

### Overview

Shared inline form and the history detail entry point.

### Changes Required:

#### 1. Shared component

**File**: `frontend/src/components/SaveAsPlan.tsx`

**Intent**: A "Save as plan" button that expands to an inline form with a name field (prefilled, editable, max 60), Save and Cancel buttons; on save it calls `createPlan` with the mapped entries and shows a success message with a link to the new plan, or a translated error.

**Contract**: props `{ sets: {exerciseId: string; reps: number}[]; defaultName: string }`. Renders nothing when `workoutToPlanEntries(sets)` is empty. Save is disabled while submitting or when the name is blank. Uses existing shared classes (`btn-primary`, `btn-secondary`, fields) from `styles/page.css`; any new control has hover, focus-visible and disabled states; no literal colours or arbitrary values (`npm run check:tokens`).

#### 2. History detail wiring

**File**: `frontend/src/pages/HistoryDetailPage.tsx`

**Intent**: Render `SaveAsPlan` in the actions area for a loaded workout, passing the flattened sets in group order and `defaultPlanName(data.planName, data.startedAt)`.

**Contract**: sets are built from `data.exercises` in order (group order is workout order).

#### 3. Strings

**File**: `frontend/src/i18n/locales/*`

**Intent**: Add `saveAsPlan.*` keys (button, name label, save, cancel, success, view plan, failure) in every locale so `locales.test.ts` stays green.

### Success Criteria:

#### Automated Verification:

- Unit and locale tests pass: `cd frontend && npm test`
- Build and lint pass: `cd frontend && npm run build && npm run lint`
- Token guard passes: `cd frontend && npm run check:tokens`

#### Manual Verification:

- On a history detail page, the form opens prefilled, saves, and the new plan appears in `/plans` with matching exercises, order, sets and reps.
- Error state is shown when saving fails (e.g. backend stopped), and the form stays usable.
- Hover, focus-visible and disabled states are visible on the new buttons.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Post-"End workout" prompt and e2e

### Overview

Offer the same action right after ending a workout, and cover both entry points end to end.

### Changes Required:

#### 1. Ended-workout panel

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: In `handleEnd`, capture the ended session's sets (and plan name/start time) before clearing the session, and show a panel with a "Workout saved" message and `SaveAsPlan` until the user starts another workout or dismisses it.

**Contract**: new local state `endedSummary: {sets; defaultName} | null`, set after a successful `endSession` only when the session had sets; cleared in `handleStart` and on dismiss.

#### 2. E2E spec

**File**: `frontend/e2e/save-workout-as-plan.spec.ts`

**Intent**: Seed a workout via API (two exercises, several sets), then verify (a) saving from the history detail page and (b) saving from the post-End panel each create a plan visible on `/plans` with the expected entries.

**Contract**: follows `delete-workout.spec.ts` conventions (`registerViaApi`, `exerciseId`, `auth`, English locale). No screenshot baselines are added or refreshed.

### Success Criteria:

#### Automated Verification:

- New e2e spec passes (Postgres running): `cd frontend && npm run test:e2e -- save-workout-as-plan`
- Existing workout/dashboard specs still pass: `cd frontend && npm run test:e2e`
- Unit tests, build, lint and token guard pass: `cd frontend && npm test && npm run build && npm run lint && npm run check:tokens`

#### Manual Verification:

- After "End workout" the panel appears, saving works, and starting a new workout hides it.
- A workout with no sets shows no panel.
- Existing `workout-ui` visual specs are unchanged.

---

## Testing Strategy

### Unit Tests:

- `workoutToPlanEntries` and `defaultPlanName` edge cases listed in Phase 1.

### Integration Tests:

- The Playwright spec exercising both entry points against the real backend.

### Manual Testing Steps:

1. Finish a workout with two exercises and varied reps; save as plan from history detail; open the plan.
2. Repeat from the post-End panel.
3. Try a very long plan name and a blank name.

## Performance Considerations

None; one POST and a small in-memory mapping.

## Migration Notes

None; no schema or API changes.

## References

- Existing endpoint: `src/main/java/com/example/gymtrack/plan/TrainingPlanController.java`
- Request contract: `src/main/java/com/example/gymtrack/plan/PlanRequest.java`, `PlanEntryRequest.java`
- Similar e2e: `frontend/e2e/delete-workout.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mapping util

#### Automated

- [x] 1.1 Mapping tests pass — bc8435c
- [x] 1.2 Type checking and build pass — bc8435c
- [x] 1.3 Linting passes — bc8435c

#### Manual

- [x] 1.4 Util behavior matches the agreed rules — bc8435c

### Phase 2: Save-as-plan component and history integration

#### Automated

- [x] 2.1 Unit and locale tests pass — fa98b2c
- [x] 2.2 Build and lint pass — fa98b2c
- [x] 2.3 Token guard passes — fa98b2c

#### Manual

- [x] 2.4 History detail save creates the matching plan — fa98b2c
- [x] 2.5 Error state is shown and form stays usable — fa98b2c
- [x] 2.6 Hover, focus-visible and disabled states are visible — fa98b2c

### Phase 3: Post-"End workout" prompt and e2e

#### Automated

- [x] 3.1 New e2e spec passes — a22283d
- [x] 3.2 Existing e2e specs still pass — a22283d
- [x] 3.3 Unit tests, build, lint and token guard pass — a22283d

#### Manual

- [x] 3.4 Post-End panel appears, saves, and hides on new workout — a22283d
- [x] 3.5 No panel for a workout with no sets — a22283d
- [x] 3.6 Existing visual specs unchanged — a22283d
