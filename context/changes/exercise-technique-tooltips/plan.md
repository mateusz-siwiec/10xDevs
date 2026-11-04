# Technique tooltips for predefined exercises — Implementation Plan

## Overview

Every predefined (seeded) exercise gets a short cue list (3-4 steps) on proper technique, in Polish and English. It is shown through a reusable `TechniqueTooltip` in three places: the exercises list, the workout picker area and the substitutes panel. Text lives in the i18next locale files keyed by exercise slug, so there is no DB migration and no API change. Custom exercises have no entry and show no tooltip.

## Current State Analysis

- 40 seeded exercises are inserted by `src/main/resources/db/migration/V2__create_exercises_and_seed.sql`; each has a stable `slug`. Custom exercises get slug `custom-<uuid>` (`Exercise.java`).
- `frontend/src/utils/exercises.ts` already resolves display names via `exercises.<slug>` in the locale files and falls back to the typed name for custom exercises. Technique text can follow the same pattern.
- `frontend/src/i18n/locales.test.ts` already scans the migrations for seeded slugs and asserts an `exercises.<slug>` entry exists in `en` and `pl`; it also asserts en/pl key parity (its `flatten` treats arrays as nested objects, so array values keep parity checking working).
- `i18next.d.ts` types keys from `en.json`; runtime-built keys go through the untyped `translate` cast used in `utils/exercises.ts`.
- Exercises list row: `ExercisesPage.tsx:165` renders the name in `.plan-item-name`.
- Workout: the current exercise is only visible in the native `<select>` of `ExercisePicker` (cannot hold a control) and in `PlanWalkthrough` entries (each is a `<button>`, so a nested control is invalid). `WorkoutPage.tsx:309-323` has an `exercise-picker-row` that holds the picker and the "Find substitute" button; `exercisesById` / `selectedExercise` are available there.
- `SubstituteSuggestions.tsx:69-82` lists up to 3 `Exercise` items (they carry `slug`).
- No tooltip component exists. `ExercisesMenu.tsx` is the closest precedent for popover behaviour (Escape, outside `mousedown`, blur-out closes, `aria-expanded`).
- UI rules (CLAUDE.md): tokens only, hover/focus-visible/disabled states on interactive controls, shared classes live in `styles/page.css`, `npm run check:tokens` scans an explicit file list in `frontend/scripts/check-hardcoded-values.mjs`.
- The working branch `fix/exercises-row-layout` has uncommitted edits to `ExercisesPage.tsx` and `exercises.css`; commit/merge them before Phase 3 to avoid mixing changes.

## Desired End State

On the exercises list, the workout screen and the substitutes panel, each predefined exercise shows a small info button. Hover, keyboard focus or tap opens a panel with 3-4 technique cues in the active language (it switches with the language switcher); Escape, outside click or leaving focus closes it. Custom exercises show no button. Verified by locale tests, `check:tokens`, lint/build and Playwright specs.

### Key Discoveries:

- Technique key must be a new top-level namespace `exerciseTechnique.<slug>`; `exercises.<slug>` is already a string name (`en.json:161+`).
- Placement during a workout must be outside the `<select>` and walkthrough buttons: a trigger in `exercise-picker-row` bound to `selectedExercise`.
- `check-hardcoded-values.mjs` lists files explicitly, so the new component and its CSS must be added to be guarded.

## What We're NOT Doing

- No DB migration, no `Exercise`/`ExerciseResponse` change, no backend work.
- No tooltip in the plan editor (`PlanExerciseList`), `PlanWalkthrough`, history, or on the custom exercise form.
- No editing of technique text by users, no images/videos, no safety disclaimer text.
- No replacement of the native exercise `<select>`.
- No refresh of Playwright visual baselines unless a change has an explained visual delta.

## Implementation Approach

Keep the text in locale JSON (the app is already bilingual) and expose it through one helper that returns `string[] | null`. Build one self-contained `TechniqueTooltip` (info button + panel) and reuse it in the three places; the component renders nothing when the helper returns `null`, which makes custom exercises work with no extra branching. Content is drafted in Phase 1 and reviewed by the user in the PR.

## Phase 1: Technique content and lookup

### Overview

Add the technique cues for all 40 seeded slugs in both languages, a lookup helper, and tests that guard completeness.

### Changes Required:

#### 1. Locale content

**File**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Add a top-level `exerciseTechnique` object with, per seeded slug, an array of 3-4 short cue strings; add UI strings for the trigger (`exercises.techniqueLabel` with `{{name}}`, and a heading for the panel). Polish text must be natural gym Polish and consistent with existing exercise names in `pl.json`.

**Contract**: `exerciseTechnique.<slug>: string[]` (3-4 non-empty entries) for every slug seeded by migrations; en/pl keys identical.

#### 2. Lookup helper

**File**: `frontend/src/utils/exercises.ts`

**Intent**: Add `exerciseTechnique(exercise)` that returns the cue list in the active language, or `null` when the slug has no entry (custom exercises).

**Contract**: `exerciseTechnique({ slug }: { slug: string }): string[] | null`; uses `i18n.exists` plus `returnObjects`, through the same untyped-cast pattern as `translate`. Reads i18n at call time, so callers re-render on language change (same caveat as `exerciseName`).

#### 3. Tests

**File**: `frontend/src/i18n/locales.test.ts`

**Intent**: Add a `describe('seeded exercise technique')` mirroring the existing seeded-names tests: every seeded slug has an array of 3-4 non-empty strings in `en` and `pl`; no `exerciseTechnique` entry exists for unknown slugs.

**Contract**: reuses the existing `seededSlugs` extraction.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (from `frontend/`)
- Type checking and build pass: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Technique wording in English reviewed for all 40 exercises
- Technique wording in Polish reviewed for all 40 exercises

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: TechniqueTooltip component

### Overview

A reusable, accessible info-button-plus-panel component using only design tokens.

### Changes Required:

#### 1. Component

**File**: `frontend/src/components/TechniqueTooltip.tsx`

**Intent**: Render an info button (icon, accessible name `exercises.techniqueLabel` with the exercise name) that opens a panel listing the cues. Renders `null` when there are no cues. Opens on pointer hover and keyboard focus; tap/click toggles it (touch has no hover), Escape closes it and returns focus to the button, outside `mousedown` and focus leaving the component close it (follow `ExercisesMenu.tsx` patterns). Panel is linked via `aria-describedby`/`aria-expanded`; hover must keep the panel open when the pointer moves onto it (WCAG 1.4.13).

**Contract**: `TechniqueTooltip({ exercise }: { exercise: { slug: string; name: string } })`. Panel id from `useId`. The panel must not overflow the viewport on a 390px-wide phone and must not be clipped by `.plan-item` / `.exercise-picker-row` containers.

#### 2. Styles

**File**: `frontend/src/styles/page.css` (shared class `.technique-*`)

**Intent**: Style the trigger and panel with tokens only (`--bg`, `--border`, `--text`, `--radius`, `--shadow`, `--accent`, `--ring`); trigger has hover, focus-visible and disabled states and a >=44px touch target (matches `exercise-secondary-option`).

**Contract**: classes `.technique-trigger`, `.technique-panel`, `.technique-list`; no literal colours or arbitrary values.

#### 3. Token guard

**File**: `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Add `src/components/TechniqueTooltip.tsx` to `FILES` (`page.css` and the workout files are already listed).

**Contract**: `check:tokens` still exits 0.

### Success Criteria:

#### Automated Verification:

- Token guard passes: `npm run check:tokens`
- Type checking and build pass: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Hover, focus, tap, Escape and outside click behave as specified in light and dark mode
- Panel stays inside the viewport on a 390px-wide screen

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Placements

### Overview

Wire the component into the three agreed places.

### Changes Required:

#### 1. Exercises list

**File**: `frontend/src/pages/ExercisesPage.tsx` (and `frontend/src/styles/exercises.css` if spacing needs it)

**Intent**: Render the tooltip next to the exercise name in `.plan-item-name`, without breaking the row layout fixed on this branch (Edit/Delete stay right-aligned on a phone).

**Contract**: `<TechniqueTooltip exercise={exercise} />` after the name; custom rows render nothing extra.

#### 2. Workout picker area

**File**: `frontend/src/pages/WorkoutPage.tsx`

**Intent**: In `exercise-picker-row`, show the tooltip for the currently selected exercise (looked up via `exercisesById.get(selectedExercise)`), so it works for plan and free-form workouts and follows the selection. Nothing renders when no exercise is selected.

**Contract**: placed beside `ExercisePicker` / "Find substitute"; layout of the row remains usable on 390px.

#### 3. Substitutes panel

**File**: `frontend/src/components/SubstituteSuggestions.tsx`

**Intent**: Show the tooltip in each suggestion item next to the exercise name so users can judge an unfamiliar replacement.

**Contract**: inside `.substitute-item-info`, using the `Exercise` already in each item.

### Success Criteria:

#### Automated Verification:

- Token guard passes: `npm run check:tokens`
- Type checking and build pass: `npm run build`
- Linting passes: `npm run lint`
- Existing e2e specs still pass: `npm run test:e2e`

#### Manual Verification:

- Tooltip visible and readable in all three places in en and pl
- Custom exercises show no tooltip anywhere
- Row layout on the list unchanged on a phone width

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Playwright coverage

### Overview

Browser tests for behaviour that unit tests cannot cover.

### Changes Required:

#### 1. List spec

**File**: `frontend/e2e/exercises-list.spec.ts`

**Intent**: Built-in row has a technique trigger that opens the cue list on click and focus, closes on Escape (focus returns to the trigger) and outside click; custom row has no trigger; switching language to Polish shows the Polish cues.

**Contract**: reuse `registerViaApi`, `seedCustom`, `login` helpers; names via `getByRole('button', { name: /technique/i })` style accessible names.

#### 2. Workout and substitutes spec

**File**: `frontend/e2e/workout-ui.spec.ts` or a new `frontend/e2e/technique-tooltip.spec.ts`

**Intent**: During a started workout, selecting a built-in exercise shows its technique via the picker-area trigger and changing the selection changes the content; the substitutes panel items expose the trigger. No new visual snapshots unless a visual delta is explained.

**Contract**: use API helpers (`exerciseId`) to start a session and pick exercises.

### Success Criteria:

#### Automated Verification:

- E2E suite passes (Postgres running): `npm run test:e2e`
- Unit tests pass: `npm test`
- Token guard and lint pass: `npm run check:tokens && npm run lint`

#### Manual Verification:

- Smoke test on a real phone viewport via the dev server, including tap behaviour

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Every seeded slug has 3-4 non-empty technique cues in en and pl; en/pl key parity holds.
- `exerciseTechnique` returns `null` for `custom-<uuid>` slugs.

### Integration Tests:

- Playwright: open/close behaviour (hover/focus/click, Escape, outside click), custom exercise has none, language switch, workout selection change, substitutes panel.

### Manual Testing Steps:

1. Open `/exercises`, hover and tab to the info button of a built-in exercise; read the cues; press Escape.
2. Switch language to Polish and repeat.
3. Start a workout, change the selected exercise and check the cues follow.
4. Open "Find substitute" and open a suggestion's cues.
5. Repeat on a 390px viewport with touch emulation.

## Performance Considerations

Static JSON lookups only; no extra network requests. Locale bundles grow by ~80 short texts.

## Migration Notes

None. No data or API changes; custom exercises are unaffected.

## References

- Change identity: `context/changes/exercise-technique-tooltips/change.md`
- Name lookup pattern: `frontend/src/utils/exercises.ts:12-20`
- Seeded-slug test pattern: `frontend/src/i18n/locales.test.ts:53-72`
- Popover behaviour precedent: `frontend/src/components/ExercisesMenu.tsx:46-93`
- Token guard file list: `frontend/scripts/check-hardcoded-values.mjs:9-27`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Technique content and lookup

#### Automated

- [x] 1.1 Unit tests pass: `npm test` (from `frontend/`) — 25a716a
- [x] 1.2 Type checking and build pass: `npm run build` — 25a716a
- [x] 1.3 Linting passes: `npm run lint` — 25a716a

#### Manual

- [x] 1.4 Technique wording in English reviewed for all 40 exercises — 25a716a
- [x] 1.5 Technique wording in Polish reviewed for all 40 exercises — 25a716a

### Phase 2: TechniqueTooltip component

#### Automated

- [x] 2.1 Token guard passes: `npm run check:tokens` — be2792b
- [x] 2.2 Type checking and build pass: `npm run build` — be2792b
- [x] 2.3 Linting passes: `npm run lint` — be2792b

#### Manual

- [x] 2.4 Hover, focus, tap, Escape and outside click behave as specified in light and dark mode — be2792b
- [x] 2.5 Panel stays inside the viewport on a 390px-wide screen — be2792b

### Phase 3: Placements

#### Automated

- [x] 3.1 Token guard passes: `npm run check:tokens` — c62433f
- [x] 3.2 Type checking and build pass: `npm run build` — c62433f
- [x] 3.3 Linting passes: `npm run lint` — c62433f
- [x] 3.4 Existing e2e specs still pass: `npm run test:e2e` — c62433f

#### Manual

- [x] 3.5 Tooltip visible and readable in all three places in en and pl — c62433f
- [x] 3.6 Custom exercises show no tooltip anywhere — c62433f
- [x] 3.7 Row layout on the list unchanged on a phone width — c62433f

### Phase 4: Playwright coverage

#### Automated

- [x] 4.1 E2E suite passes (Postgres running): `npm run test:e2e` — 1547a80
- [x] 4.2 Unit tests pass: `npm test` — 1547a80
- [x] 4.3 Token guard and lint pass: `npm run check:tokens && npm run lint` — 1547a80

#### Manual

- [x] 4.4 Smoke test on a real phone viewport via the dev server, including tap behaviour — 1547a80
