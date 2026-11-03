# Unified exercises list Implementation Plan

> Note: the change id is `exercises-nav-menu` from the original idea (a top-bar dropdown). During planning the design changed to a single filtered list with a plain nav link; the id is kept because change ids are not renamed.

## Overview

Replace the custom-only exercises page with one list at `/exercises` that shows all exercises (built-in and custom), with an All / Mine filter and a muscle-group filter. The top bar keeps its plain "Exercises" link. Adding and editing an exercise move to their own form page. No backend changes.

## Current State Analysis

- `Topbar.tsx` has one `NavLink` to `/exercises`; `titleKey` maps `/exercises` to `nav.exercises`. The drawer layout is untouched by this plan.
- `MyExercisesPage.tsx` (route `/exercises`) holds the create/edit form and a list filtered to custom exercises (`list.filter((e) => e.custom)`), with Edit and Delete (inline confirm) per row.
- `GET /api/exercises` already returns built-in and custom exercises with `primaryMuscleGroup`, `secondaryMuscleGroups` and `custom` (`Exercise` in `frontend/src/api/client.ts:136`). Create, update and delete wrappers exist (`createExercise`, `updateExercise`, `deleteExercise`).
- Helpers exist: `exerciseName`, `sortExercisesByName` (`utils/exercises.ts`), `MUSCLE_GROUPS`, `muscleGroupLabel` (`utils/muscleGroups.ts`).
- Shared styles: `.plan-list`, `.plan-item*`, `.workout-select`, `.field`, `.btn-*` in `page.css` / `plans.css` / `exercises.css`. Tokens only, enforced by `npm run check:tokens`.
- Tests: `data-isolation.spec.ts` clicks the "Exercises" link and expects another user's custom exercise absent; `mobile-menu.spec.ts` expects the "Exercises" link in the drawer. Both stay valid because the nav link is unchanged.

## Desired End State

`/exercises` shows every exercise with its primary and secondary muscles and a "Custom" tag on the user's own. The user can switch All / Mine, narrow by muscle group, press "Add exercise" to open `/exercises/new`, and Edit (`/exercises/:id/edit`) or Delete only their own exercises. Saving or cancelling the form returns to the list.

### Key Discoveries:

- No backend change is needed; filtering is done client-side on the full list.
- The list rows and delete-confirm logic already exist in `MyExercisesPage.tsx` and can be moved rather than rewritten.
- The form needs the exercise being edited; it can load it from `getExercises()` by id (no single-exercise endpoint is required).

## What We're NOT Doing

- No top-bar dropdown, mobile drawer group or new nav entries.
- No backend, schema or API changes.
- No editing of built-in exercises, and no search-by-name box.
- No redirects or aliases for other URLs (`/exercises` keeps its path but now shows the list of all exercises).

## Implementation Approach

Reuse the existing page as the list (drop its form), extract the form into a new page, wire the routes, then cover it with e2e. Filters are local component state.

## Phase 1: Unified list page

### Overview

`/exercises` becomes the filtered list of all exercises.

### Changes Required:

#### 1. List page

**File**: `frontend/src/pages/MyExercisesPage.tsx` (rename to `ExercisesPage.tsx`; update the import in `App.tsx`)

**Intent**: Show all exercises sorted by name, each with primary and secondary muscles and a "Custom" tag where `custom` is true. Add an All / Mine segmented filter and a muscle-group select (any muscle, matching primary or secondary). Custom rows keep Edit and Delete with the existing inline confirm; built-in rows have no actions. An "Add exercise" button links to `/exercises/new`. Remove the inline create/edit form from this page.

**Contract**: filter state `{ scope: 'all' | 'mine'; muscle: '' | MuscleGroup }` held in the component. Empty states: no exercises at all, and no matches for the current filters (with a "clear filters" action). Edit links to `/exercises/:id/edit`. New controls (segmented buttons, select, Add button) have hover, focus-visible and disabled states and use only tokens and shared classes.

### Success Criteria:

#### Automated Verification:

- Build passes: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`
- Token guard passes: `cd frontend && npm run check:tokens`
- Unit and locale tests pass: `cd frontend && npm test`

#### Manual Verification:

- `/exercises` lists built-in and custom exercises; custom ones are tagged and have Edit/Delete.
- All / Mine and the muscle filter combine correctly; empty states appear and "clear filters" resets them.
- Deleting a custom exercise still asks for confirmation.

**Implementation Note**: After this phase and its automated checks pass, pause for manual confirmation before Phase 2.

---

## Phase 2: Form page

### Overview

Create and edit live on their own page and return to the list.

### Changes Required:

#### 1. Form page and routes

**File**: `frontend/src/pages/ExerciseFormPage.tsx`, `frontend/src/App.tsx`

**Intent**: Move the name, primary and secondary muscle fields and validation from the old page into a new page used for both create and edit. Register `/exercises/new` and `/exercises/:id/edit` behind `RequireAuth`.

**Contract**: in edit mode the exercise is found in `getExercises()` by `:id`; a missing id or a built-in exercise (`custom === false`) shows a not-found message with a link back. Successful save and Cancel navigate to `/exercises`. Existing error handling (`exercises.addFailed` / `updateFailed`) and the `NAME_MAX_LENGTH = 60` limit are preserved. `Topbar.titleKey` keeps `nav.exercises` for all `/exercises*` paths (already `startsWith`).

### Success Criteria:

#### Automated Verification:

- Build, lint and token guard pass: `cd frontend && npm run build && npm run lint && npm run check:tokens`
- Unit and locale tests pass: `cd frontend && npm test`

#### Manual Verification:

- "Add exercise" opens the form, saving returns to the list with the new exercise visible.
- Edit pre-fills the form, saving updates the row; Cancel returns without changes.
- A bad id or a built-in exercise's edit URL shows the not-found state.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Tests and strings

### Overview

Translations and end-to-end coverage.

### Changes Required:

#### 1. Strings

**File**: `frontend/src/i18n/locales/en.json`, `pl.json`

**Intent**: Add keys for the scope filter (All / Mine), muscle filter label and "all muscles" option, "Custom" tag, "Add exercise" button, no-matches message, "clear filters", and the form-page not-found text, in both locales so `locales.test.ts` stays green. Rename or reuse existing `exercises.*` keys rather than duplicating them.

#### 2. E2E

**File**: `frontend/e2e/exercises-list.spec.ts` (new); `frontend/e2e/data-isolation.spec.ts` (verify unchanged behaviour)

**Intent**: Seed a custom exercise via API, then verify built-in and custom both appear, Mine hides built-ins, the muscle filter narrows the list, add via the form shows up in the list, edit updates it, and delete (with confirmation) removes it. Re-run `data-isolation.spec.ts` and `mobile-menu.spec.ts` to confirm they pass unchanged.

**Contract**: follows `delete-workout.spec.ts` conventions (`registerViaApi`, `auth`, English locale, login via UI). No screenshot baselines are added or refreshed.

### Success Criteria:

#### Automated Verification:

- New spec passes (Postgres running): `cd frontend && npm run test:e2e -- exercises-list`
- Existing isolation and mobile specs pass: `cd frontend && npm run test:e2e -- data-isolation mobile-menu`
- Full e2e passes: `cd frontend && npm run test:e2e`
- Unit tests, build, lint and token guard pass: `cd frontend && npm test && npm run build && npm run lint && npm run check:tokens`

#### Manual Verification:

- Polish and English strings read correctly on the list and form.
- Keyboard: filters and buttons are reachable with visible focus.

---

## Testing Strategy

### Unit Tests:

- Locale parity (`locales.test.ts`) covers new keys. If the filter logic is extracted into a pure helper it gets its own vitest cases (scope, muscle match on primary or secondary).

### Integration Tests:

- `exercises-list.spec.ts` against the real backend.

### Manual Testing Steps:

1. Open `/exercises`; switch All / Mine and pick a muscle.
2. Add, edit and delete a custom exercise.
3. Visit `/exercises/<bad-id>/edit`.

## Performance Considerations

None; filtering a few dozen items in memory.

## Migration Notes

None; no schema or API changes. Old `/exercises` bookmarks now land on the list.

## References

- Current page: `frontend/src/pages/MyExercisesPage.tsx`
- Exercise API client: `frontend/src/api/client.ts:136`
- Similar e2e: `frontend/e2e/delete-workout.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Unified list page

#### Automated

- [x] 1.1 Build passes — d7de0db
- [x] 1.2 Lint passes — d7de0db
- [x] 1.3 Token guard passes — d7de0db
- [x] 1.4 Unit and locale tests pass — d7de0db

#### Manual

- [x] 1.5 List shows built-in and custom exercises with Custom tag and actions — d7de0db
- [x] 1.6 All / Mine and muscle filters combine; empty states work — d7de0db
- [x] 1.7 Delete still asks for confirmation — d7de0db

### Phase 2: Form page

#### Automated

- [x] 2.1 Build, lint and token guard pass
- [x] 2.2 Unit and locale tests pass

#### Manual

- [x] 2.3 Add returns to the list with the new exercise
- [x] 2.4 Edit pre-fills, saves, and Cancel leaves it unchanged
- [x] 2.5 Bad id or built-in edit URL shows not-found

### Phase 3: Tests and strings

#### Automated

- [ ] 3.1 New exercises-list e2e spec passes
- [ ] 3.2 Existing isolation and mobile specs pass
- [ ] 3.3 Full e2e passes
- [ ] 3.4 Unit tests, build, lint and token guard pass

#### Manual

- [ ] 3.5 Polish and English strings read correctly
- [ ] 3.6 Keyboard focus is visible on filters and buttons
