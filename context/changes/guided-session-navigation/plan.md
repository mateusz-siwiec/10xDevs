# Guided Session Navigation Implementation Plan

## Overview

Turn plan-driven workouts into a guided walkthrough (FR-007) and add a countdown rest timer between sets (FR-008). In a plan session the user can skip the current exercise, see it marked "Skipped", and return to it later in the same session; the walkthrough falls back to skipped entries once everything else is done. A rest timer starts automatically after each logged set in every session. Both features are frontend-only: skip state lives in `WorkoutPage` state and the timer duration preference in `localStorage`. No schema or API changes.

## Current State Analysis

- `PlanWalkthrough.tsx` renders the plan as a tap-to-select list. `planProgress.ts` computes per-entry logged counts by walking entries in position order and consuming sets of the same exercise, and `currentIndex` returns the first entry below its set target.
- `WorkoutPage.tsx` auto-selects that current entry's exercise (`autoId`) and honours a manual pick only while `autoId` is unchanged (`manual` state). Once every entry is done it stays on the last entry.
- There is no skip concept and no way to move past an entry other than picking another exercise. S-04 deliberately left "unavailable" UI-only and deferred real skip/return state to this slice.
- Free-form sessions (no `planId`) have no ordering; they only use `ExercisePicker`.
- There is no timer anywhere. `SetLogger` is a plain form; `WorkoutPage.handleLog` is the single place where a set is logged successfully.
- The frontend has no test runner; verification is `npm run lint`, `npm run build` and manual checks. Touch targets are at least 48px inside `.workout-card` (`workout.css`).

## Desired End State

In a plan session, each walkthrough entry offers a Skip action for the selected entry. A skipped entry shows a "Skipped" badge, the walkthrough moves to the next pending entry, and tapping the skipped entry (or logging a set on it) returns to it and clears the skip. When every non-skipped entry is done and some are still skipped, the first skipped entry is auto-selected. In any session, logging a set starts a rest countdown (default 90 s, presets 60/90/120/180 s remembered per device) with +30 s and Skip rest buttons; at zero it shows "Rest over" and vibrates where supported. Ending the workout clears both skip state and the timer. Verified by lint, build and the manual steps below.

### Key Discoveries:

- `frontend/src/components/planProgress.ts:28` `currentIndex` is the only place deciding which entry is current; making it skip-aware changes the walkthrough and auto-selection together.
- `frontend/src/components/PlanWalkthrough.tsx:17-20` duplicates a "selected index" rule (current entry if its exercise matches, else first entry of that exercise); skip must target the same entry, so this rule moves into `planProgress.ts`.
- `frontend/src/pages/WorkoutPage.tsx:112` `handleLog` is the single success path for logging a set, so it is the timer trigger and the place a skip is cleared.
- `frontend/src/pages/WorkoutPage.tsx:32` `manual` is only valid while `autoId` is unchanged; skipping changes `autoId`, which naturally drops any stale manual pick.
- Plan entries are identified by `position` (`context/archive/2026-10-26-user-defined-training-plan/plan-brief.md:55`), and the same exercise can appear twice, so skip state is keyed by entry `position`, not `exerciseId`.

## What We're NOT Doing

- Persisting skip state on the backend or in storage; a page reload shows skipped entries as pending again (accepted).
- Navigation for free-form sessions (no plan); they get only the rest timer.
- Separate Previous/Next buttons or a navigator bar; the walkthrough list stays the navigation surface.
- Per-plan-entry rest targets, schema or plan-editor changes.
- Audio alerts or notifications; the end-of-rest signal is visual plus `navigator.vibrate` where supported.
- Syncing the rest preference across devices; it is per-browser `localStorage`.
- A frontend test runner; verification stays lint + build + manual.

## Implementation Approach

Two phases, navigation first because it reshapes selection logic in `WorkoutPage`, then the self-contained timer. All new decision logic (skip-aware current/selected entry) is kept in pure functions in `planProgress.ts` so it is easy to review without a test runner. The timer stores an absolute end timestamp and derives remaining time from `Date.now()` on each tick, so it stays correct when the tab is backgrounded or throttled.

## Phase 1: Skip and return in plan sessions

### Overview

Add skip-aware progress logic, a Skip action and badge in the walkthrough, and the skipped state in `WorkoutPage`.

### Changes Required:

#### 1. Skip-aware plan progress helpers

**File**: `frontend/src/components/planProgress.ts`

**Intent**: Make "which entry is current" and "which entry is selected" skip-aware and shared, so the walkthrough list and the page's auto-selection cannot disagree.

**Contract**: `currentIndex(progress, skipped?: ReadonlySet<number>)` returns the first entry that is not done and not skipped (by `entry.position`); if none, the first entry that is not done (a skipped one); if none, `-1`. New `selectedIndex(progress, current, selectedExerciseId)` implements the rule currently inline in `PlanWalkthrough` (current entry if its exercise matches, else first entry of that exercise, else `-1`). A skipped entry that becomes done is treated as done; the existing one-argument call sites keep working.

#### 2. Walkthrough Skip action and badge

**File**: `frontend/src/components/PlanWalkthrough.tsx`

**Intent**: Show which entries are skipped and let the user skip the selected one, while keeping tap-to-select as the way to return.

**Contract**: Props gain `skipped: ReadonlySet<number>` and `onSkip: (position: number) => void`. Skipped, not-done entries render a "Skipped" badge and a modifier class; tapping any entry still calls `onSelect`. A "Skip" button (min 48px, rendered inside or directly under the selected entry, outside the entry's select button to avoid nested interactive elements) is shown only for the selected, not-done entry and calls `onSkip(entry.position)`. Uses `selectedIndex` from `planProgress.ts`.

#### 3. Page state and wiring

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Hold skipped positions for the active session, feed them into progress/auto-selection, and clear them on return, on logging, and when the session ends.

**Contract**: `skipped` state is a `Set<number>` of entry positions. `autoIndex` uses the skip-aware `currentIndex`. `handleSkip(position)` adds it to `skipped` and clears `manual` and `substituteFor` so selection moves to the next pending entry. `handleSelect` removes the selected entry's position from `skipped` when the user picks a walkthrough entry (return), and `handleLog` removes the position of the entry the set is credited to. `handleEnd` and starting a new session reset `skipped`. When all non-skipped entries are done and skipped ones remain, a short "Return to skipped exercises" hint is shown above the walkthrough. Free-form sessions render no walkthrough and are unaffected.

#### 4. Styles

**File**: `frontend/src/styles/workout.css`

**Intent**: Style the skipped state, badge and Skip button consistently with the existing walkthrough, usable at phone width.

**Contract**: New classes only (`walkthrough-entry-skipped`, `walkthrough-skip-btn`, badge); reuse `--border`, `--accent`, `--accent-bg` tokens; touch targets at least 48px.

### Success Criteria:

#### Automated Verification:

- Frontend lint passes: `npm run lint` (from `frontend/`)
- Frontend type-check and build pass: `npm run build` (from `frontend/`)

#### Manual Verification:

- In a plan session, pressing Skip on the current entry marks it "Skipped" and selects the next pending entry.
- Tapping a skipped entry returns to it and removes its badge; logging a set on it also clears the skip.
- After all non-skipped entries are done, the first skipped entry is auto-selected and a return hint is shown.
- A skipped entry that later reaches its set target shows as done.
- Free-form sessions show no walkthrough, and ending the workout clears skipped state.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Rest timer

### Overview

Add a countdown rest timer that starts after each logged set in every session.

### Changes Required:

#### 1. Rest timer component

**File**: `frontend/src/components/RestTimer.tsx` (new)

**Intent**: Show a countdown with controls, driven by an absolute end time so it is accurate after the tab is backgrounded.

**Contract**: Props `{ endsAt: number | null; onChange: (endsAt: number | null) => void; durationSec: number; onDurationChange: (sec: number) => void }`. While `endsAt` is in the future it shows `m:ss` remaining (ticking via an interval that recomputes from `Date.now()`), a "+30 s" button (adds 30 s to `endsAt`) and "Skip rest" (calls `onChange(null)`). When remaining reaches zero it shows "Rest over", calls `navigator.vibrate?.([200, 100, 200])` once, and announces via an `aria-live="polite"` region. When `endsAt` is null it shows only the duration preset selector (60/90/120/180 s). Intervals are cleaned up on unmount and when `endsAt` changes.

#### 2. Duration preference

**File**: `frontend/src/components/restDuration.ts` (new)

**Intent**: Read and write the chosen rest duration with a safe default.

**Contract**: `loadRestDuration(): number` returns the stored value if it is one of the allowed presets, else `90`; `saveRestDuration(sec: number): void`. Every `localStorage` access is wrapped in try/catch so a blocked or empty storage still works.

#### 3. Page wiring

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: Start the timer when a set is logged and clear it when the session ends.

**Contract**: State `restEndsAt: number | null` and `restDuration` (initialised from `loadRestDuration`). In `handleLog`, after a successful `logSet`, set `restEndsAt = Date.now() + restDuration * 1000`. `handleEnd` and a new session clear it. Deleting a set does not touch the timer. `RestTimer` renders in the active-session view between `SetLogger` and the chart, for plan and free-form sessions alike.

#### 4. Styles

**File**: `frontend/src/styles/workout.css`

**Intent**: Style the timer block, large readable countdown and 48px controls, usable at phone width.

**Contract**: New classes only; reuse existing tokens and button classes.

### Success Criteria:

#### Automated Verification:

- Frontend lint passes: `npm run lint` (from `frontend/`)
- Frontend type-check and build pass: `npm run build` (from `frontend/`)

#### Manual Verification:

- Logging a set starts a 90 s countdown automatically, in both plan and free-form sessions.
- +30 s extends it, Skip rest dismisses it, and reaching zero shows "Rest over" (and vibrates on a supporting phone).
- Changing the duration preset applies to the next set and is remembered after a reload.
- Switching the tab or locking the screen for a while and returning shows the correct remaining time.
- Ending the workout clears the timer; deleting a set does not restart it.
- Layout is usable at phone width.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- No frontend unit-test framework exists in the repo and none is added here. Decision logic is isolated in pure functions in `planProgress.ts` and `restDuration.ts` to keep review easy.

### Integration Tests:

- None; no backend changes. Existing backend suite is untouched.

### Manual Testing Steps:

1. Start a plan session with three entries, skip the first, confirm it is badged and entry two is selected.
2. Complete entries two and three; confirm entry one is auto-selected with the return hint, then log its sets and confirm all entries show done.
3. Skip an entry, tap it, confirm the badge disappears; skip again and log a set on it, confirm the same.
4. Start a free-form session, log a set, confirm the timer starts and no walkthrough is shown.
5. Let the timer reach zero, use +30 s and Skip rest, change the preset and reload to confirm it persists.
6. Background the tab for over a minute during a countdown and confirm the remaining time is correct on return.

## Performance Considerations

One interval per active timer (about 4 ticks per second) re-rendering a small component only; cleared on unmount, skip and expiry.

## Migration Notes

None. No schema or API changes; skipped state is lost on reload by design.

## References

- PRD: `context/foundation/prd.md` (FR-007, FR-008)
- Roadmap: `context/foundation/roadmap.md` (S-06)
- Prior deferral of skip state: `context/archive/2026-10-27-exercise-substitution-suggestion/plan.md:29`
- Plan entry identity by position: `context/archive/2026-10-26-user-defined-training-plan/plan-brief.md:55`
- Existing walkthrough: `frontend/src/components/PlanWalkthrough.tsx:10`, `frontend/src/components/planProgress.ts:28`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Skip and return in plan sessions

#### Automated

- [x] 1.1 Frontend lint passes
- [x] 1.2 Frontend type-check and build pass

#### Manual

- [x] 1.3 Skip marks the entry Skipped and selects the next pending entry
- [x] 1.4 Tapping a skipped entry or logging a set on it clears the skip
- [x] 1.5 After non-skipped entries are done, the first skipped entry is auto-selected with a return hint
- [x] 1.6 A skipped entry that reaches its set target shows as done
- [x] 1.7 Free-form sessions show no walkthrough and ending the workout clears skipped state

### Phase 2: Rest timer

#### Automated

- [ ] 2.1 Frontend lint passes
- [ ] 2.2 Frontend type-check and build pass

#### Manual

- [ ] 2.3 Logging a set starts a 90 s countdown in plan and free-form sessions
- [ ] 2.4 +30 s, Skip rest and Rest over (with vibration) work
- [ ] 2.5 Duration preset applies to the next set and persists after reload
- [ ] 2.6 Remaining time is correct after the tab was backgrounded
- [ ] 2.7 Ending the workout clears the timer and deleting a set does not restart it
- [ ] 2.8 Layout is usable at phone width
