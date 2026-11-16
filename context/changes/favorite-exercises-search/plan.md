# Favourite exercises and text search Implementation Plan

## Overview

Users can star exercises as favourites (per user, for catalog and custom exercises) and search exercise lists by text. Search and favourites apply to two surfaces: the Exercises page (browse/manage) and the exercise picker used when logging a workout and when editing a plan. Favourites are listed first in the picker so they speed up logging.

## Current State Analysis

- Exercises are shared catalog rows (`owner_id` null) plus per-user custom rows (`V8__add_exercise_owner.sql`). There is no per-user data on catalog rows, so a favourite flag cannot live on `exercises`.
- The backend favourites layer is **already drafted** (written before planning, status of its tests unconfirmed): `V11__create_favorite_exercises.sql`, `FavoriteExercise` / `FavoriteExerciseRepository`, `favorite` on `ExerciseResponse`, `PUT/DELETE /api/exercises/{id}/favorite`, three tests in `ExerciseControllerTest`. Phase 1 verifies and finishes it rather than rewriting it.
- `ExercisesPage.tsx` filters entirely on the client: `filters = { scope: 'all' | 'mine', muscle }`, then `sortExercisesByName`, rendered as a `plan-list` with per-row actions only for custom exercises.
- `ExercisePicker.tsx` is a native `<select>` over `sortExercisesByName(exercises)`, rendered by `WorkoutPage.tsx` (inside `.exercise-picker-row`) and `PlanEditorPage.tsx`.
- Seeded exercises are translated at runtime: `exerciseName()` returns `exercises.<slug>` when the key exists, else the stored name. Search must therefore run on the displayed name.
- Frontend conventions (`CLAUDE.md`): tokens only (`npm run check:tokens`), hover / focus-visible / disabled on every new control, EN + PL strings (`locales.test.ts` guards key parity), baselines never refreshed without an explained visual delta.

## Desired End State

- On the Exercises page each row has a star toggle; a **Favourites** option beside All / Mine shows only starred exercises; a search box narrows the list by name and combines with the scope and muscle filters.
- In the exercise picker a search box narrows the options; when the user has favourites they appear in a **Favourites** group above the rest.
- Favourites are stored per user and survive reloads and logins; one user's stars never show for another.
- Search ignores case and diacritics (typing `lawce` finds "Wyciskanie na ławce").

Verification: backend tests, Vitest unit tests, `npm run build` / `lint` / `check:tokens`, and Playwright specs for both surfaces.

### Key Discoveries:

- `frontend/src/pages/ExercisesPage.tsx:87-96` - the `visible` computation is the single place to add search and the favourites scope.
- `frontend/src/pages/ExercisesPage.tsx:35,57-63` - `pendingFocus` moves focus to the heading or a row control after a row unmounts; removing a row via un-star in the Favourites scope needs the same treatment.
- `frontend/src/components/ExercisePicker.tsx:26` - sort happens inside the picker, so grouping and filtering stay local to it; both callers keep their props.
- `frontend/src/utils/exercises.ts:16` - `exerciseName()` reads the i18n instance at call time; callers re-render on language change.
- `src/main/java/.../exercise/ExerciseRepository.java` - `existsVisible(id, userId)` already encodes catalog-or-own visibility, reused for favourite authorization.
- `frontend/e2e/exercises-list.spec.ts:5-11,30-35` - `login` / `openList` helpers and `row()` locator to reuse; built-in rows currently assert no Edit/Delete buttons, so the star's accessible name must not start with "Edit" or "Delete".
- `NFD` normalization does not decompose `ł`; the search normalizer must map it explicitly.

## What We're NOT Doing

- No server-side search or paging; lists stay client-filtered like the existing filters.
- No reordering or pinning of favourites beyond "favourites first" in the picker; no favourites on the dashboard or in plan entries.
- No star control inside the picker (favouriting happens on the Exercises page).
- No matching on muscle group labels (the muscle dropdown already covers that).
- No replacement of the native select with a custom combobox.
- No persisting of search text or scope across navigations.
- No new screenshot baselines.

## Implementation Approach

Backend first (small, already drafted), then a frontend foundation (types, API calls, shared search helper, strings) so both UI surfaces share one matching rule, then the Exercises page, then the picker. Each phase is verifiable on its own. Toggle calls are idempotent (`PUT` add, `DELETE` remove), so the UI can update optimistically and roll back on error without risking duplicate-state bugs.

## Critical Implementation Details

- **Diacritics**: normalize with `toLowerCase()`, `normalize('NFD')`, strip `̀-ͯ`, then map `ł`→`l`. Without the explicit `ł` mapping Polish typing without diacritics fails for the most common letter.
- **Picker selection survives filtering**: the currently selected exercise must stay in the option list even when it does not match the search text, otherwise the controlled `<select>` loses its value and the workout/plan flow silently loses the selection.
- **Favourite appears once in the picker**: starred exercises render only in the Favourites group, not duplicated below, so label-based `selectOption` and screen readers see each exercise once. The second group is labelled "Other exercises". With no favourites the picker renders the flat list exactly as today.

## Phase 1: Backend favourites API

### Overview

Confirm the drafted backend works, close the gaps in authorization and cleanup behaviour, and record the migration number change in the docs.

### Changes Required:

#### 1. Verify the drafted backend

**File**: `src/main/resources/db/migration/V11__create_favorite_exercises.sql`, `src/main/java/com/example/gymtrack/exercise/*`

**Intent**: Run the existing exercise tests and the full backend suite against the drafted code; fix whatever fails. The V11 migration is unreleased, so it may still be edited if a defect is found.

**Contract**: Table `favorite_exercises(user_id, exercise_id, created_at)` with composite primary key and `on delete cascade` to both `users` and `exercises`; `PUT|DELETE /api/exercises/{id}/favorite` return 204, are idempotent, and return 404 `EXERCISE_NOT_FOUND` for an exercise the caller cannot see; every `ExerciseResponse` carries `favorite`.

#### 2. Cover the remaining behaviours with tests

**File**: `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java`, `CustomExerciseControllerTest.java`

**Intent**: Add the cases the draft does not exercise: starring another user's custom exercise returns 404; deleting a custom exercise that is starred succeeds (cascade) and a later list no longer contains it; create returns `favorite: false` and update preserves an existing star; `GET /substitutes` carries the flag.

**Contract**: Assertions on `$.favorite` and on status codes only; no production change expected unless a test exposes a defect.

#### 3. Update project docs

**File**: `CLAUDE.md`, `README.md`

**Intent**: `CLAUDE.md` says the next migration is V11; it becomes V12. Add favourites and search to the Exercises row of the README feature table.

**Contract**: Text edits only.

### Success Criteria:

#### Automated Verification:

- Exercise tests pass, including migration V11 applying on a fresh container: `./mvnw test -Dtest='ExerciseControllerTest,CustomExerciseControllerTest,ExerciseSeedTest'`
- New authorization and cascade tests pass in the same run.
- Full backend suite passes: `./mvnw test`

#### Manual Verification:

- With the `local` profile and local Postgres running, `PUT` then `GET /api/exercises` shows `favorite: true` for that exercise only, and `DELETE` clears it.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Frontend foundation

### Overview

Everything both screens share: the typed API, one matching rule, and the translated strings.

### Changes Required:

#### 1. API client

**File**: `frontend/src/api/client.ts`

**Intent**: Expose the favourite flag and the two toggle calls.

**Contract**: `Exercise` gains `favorite: boolean`; `setExerciseFavorite(id: string, favorite: boolean): Promise<void>` issues `PUT` when true and `DELETE` when false against `/api/exercises/{id}/favorite`, resolving on 204 like `deleteExercise`.

#### 2. Search helper

**File**: `frontend/src/utils/exercises.ts`, `frontend/src/utils/exercises.test.ts`

**Intent**: One shared matching rule used by both screens, tested in isolation.

**Contract**: `matchesExerciseSearch(exercise: NamedExercise, query: string): boolean` returns true for an empty / whitespace query, otherwise true when the normalized displayed name (`exerciseName`) contains the normalized, trimmed query. Normalization per "Critical Implementation Details". Unit tests: case, accents (`ą ę ó ś ć ż ź ń`), `ł`, substring in the middle, whitespace-only query, language switch (Polish display name vs English), and a custom exercise whose name is as typed.

#### 3. Strings

**File**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`

**Intent**: Add the new UI text in both languages under `exercises`.

**Contract**: Keys: `scopeFavorites`, `searchLabel`, `searchPlaceholder`, `favoriteLabel` (`"Favourite {{name}}"`, used with `aria-pressed`), `favoriteFailed`, `noFavorites`, `picker.searchLabel`, `picker.favorites`, `picker.others`, `picker.noMatches`. `locales.test.ts` must stay green. Error text for `favoriteFailed` follows the existing `exercises.*Failed` pattern.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new helper tests and locale parity: `cd frontend && npm test`
- Type check and build pass: `cd frontend && npm run build`
- Lint passes: `cd frontend && npm run lint`

#### Manual Verification:

- None; this phase has no visible UI.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 3: Exercises page

### Overview

Star toggle per row, a Favourites scope, and a search box combined with the existing filters.

### Changes Required:

#### 1. Filters and visible list

**File**: `frontend/src/pages/ExercisesPage.tsx`

**Intent**: Extend the existing filter state with a search string and a third scope, and apply them in the existing `visible` computation. Clearing filters resets search too.

**Contract**: `Filters.scope: 'all' | 'mine' | 'favorites'`, `Filters.search: string`; `visible` keeps the existing scope and muscle predicates and adds `matchesExerciseSearch`; `filtersActive` includes a non-empty search. The scope toggle gets a third button ("Favourites") using the same `aria-pressed` pattern. The search is a labelled `<input type="search">` with a visible label, placed above the muscle select. The `aria-live` result count already reflects `visible.length`. When Favourites is active and the list is empty, show `exercises.noFavorites` (with the star hint) instead of the generic no-match text; with filters narrowing a non-empty set keep the existing no-match message and Clear filters.

#### 2. Star toggle

**File**: `frontend/src/pages/ExercisesPage.tsx`, `frontend/src/styles/exercises.css`

**Intent**: A star button on every row (built-in and custom), placed first in the row's right-hand actions, toggling the favourite optimistically and rolling back with an error on failure.

**Contract**: Button has `aria-pressed={exercise.favorite}` and `aria-label={t('exercises.favoriteLabel', { name })}` (must not start with "Edit"/"Delete"); minimum 44px target; hover, focus-visible and disabled states; pressed state uses existing tokens (`--accent`, `--accent-bg`), adding a token to `frontend/src/index.css` and `context/changes/dashboard-ui-contract/tokens.md` only if none fits. The star is not a glyph-only meaning: the pressed state is also conveyed by `aria-pressed` and a filled vs outline shape. While a toggle for a row is in flight that row's star is disabled. If un-starring removes the row from the Favourites scope, focus moves to the heading via the existing `pendingFocus` mechanism. The existing phone layout rule (actions to the right of the info column on one line) must still hold with the extra control.

#### 3. End-to-end specs

**File**: `frontend/e2e/exercises-list.spec.ts` (or a new `frontend/e2e/exercise-favorites.spec.ts` if the file grows unwieldy)

**Intent**: Prove the behaviours a user sees.

**Contract**: Specs: star a built-in and a custom exercise, reload, still starred; Favourites scope lists exactly the starred ones and un-starring there removes the row and focuses the heading; empty Favourites state; search narrows by name, is accent-insensitive, combines with Mine and the muscle filter, and Clear filters resets it; a second user does not see the first user's stars; failed toggle (route `PUT` to 500) rolls the star back and shows the alert; Polish UI search finds a translated seeded name typed without diacritics; phone viewport: star plus Edit/Delete stay on the row's right.

### Success Criteria:

#### Automated Verification:

- Build, lint, unit tests pass: `cd frontend && npm run build && npm run lint && npm test`
- No hard-coded values in the touched files: `cd frontend && npm run check:tokens`
- Exercises specs pass, including the existing ones: `cd frontend && npm run test:e2e -- exercises-list exercise-favorites` (Postgres running, `CI` unset)

#### Manual Verification:

- Star, filter and search look right in light and dark themes, in both languages, and on a phone-width viewport.
- Keyboard: Tab reaches the star, Space/Enter toggles it, focus ring is visible, focus is sensible after un-starring in the Favourites scope.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to the next phase.

---

## Phase 4: Exercise picker

### Overview

Add a search box and a Favourites group to the shared picker, so the workout screen and the plan editor both get them without prop changes.

### Changes Required:

#### 1. Picker search and grouping

**File**: `frontend/src/components/ExercisePicker.tsx`

**Intent**: Keep the native `<select>` and add a filter input above it. Filter options with `matchesExerciseSearch`; when the user has any favourites, render a "Favourites" `<optgroup>` first and an "Other exercises" group after it, each sorted by name; with no favourites render the flat list as today. The search text is local state of the picker.

**Contract**: Props unchanged (`exercises`, `selectedId`, `onChange`). The input has its own visible label and a stable `id` (e.g. `exercise-search`) distinct from `exercise-select`. The selected exercise is always kept in the option list (see Critical Implementation Details). When the search matches nothing, the select lists only the placeholder and a `picker.noMatches` hint is shown (announced via `aria-live="polite"`). Existing option text (`name — muscle`) is unchanged so current specs keep working.

#### 2. Layout in the two callers

**File**: `frontend/src/pages/WorkoutPage.tsx`, `frontend/src/pages/PlanEditorPage.tsx`, `frontend/src/styles/workout.css`

**Intent**: Make sure the extra field does not break `.exercise-picker-row` (picker next to technique tooltip and Find substitute) at phone width.

**Contract**: No prop changes expected; CSS changes only if the row misaligns. Tokens only, no literal values.

#### 3. End-to-end specs

**File**: `frontend/e2e/exercise-favorites.spec.ts` (or the picker-related existing spec)

**Intent**: Prove search and favourites-first in both callers.

**Contract**: Specs: workout page picker - typing narrows the options, selecting a result then clearing the search keeps the selection, accent-insensitive in Polish; with a starred exercise the Favourites group is first and the exercise appears once; with no favourites the list is flat; plan editor picker behaves the same and adding the chosen exercise to the plan still works. Existing log-set, plan and walkthrough specs must keep passing unchanged.

### Success Criteria:

#### Automated Verification:

- Build, lint, unit tests, token guard pass: `cd frontend && npm run build && npm run lint && npm test && npm run check:tokens`
- Picker and regression specs pass: `cd frontend && npm run test:e2e -- exercise-favorites log-set save-workout-as-plan progression-recommendation`
- Full e2e suite passes with no baseline changes: `cd frontend && npm run test:e2e`
- Backend still green: `./mvnw test`

#### Manual Verification:

- On a phone-width viewport the search box, select, technique tooltip and Find substitute button lay out cleanly.
- Typing quickly in the search box on the workout page does not lose the selected exercise or the in-progress set inputs.
- Light/dark and PL/EN look correct.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before closing the change.

---

## Testing Strategy

### Unit Tests:

- `matchesExerciseSearch`: case, Polish diacritics including `ł`, empty and whitespace queries, substring match, active-language display name, custom names.
- Locale key parity (`locales.test.ts`) for the new strings.

### Integration Tests:

- Backend `ExerciseControllerTest` / `CustomExerciseControllerTest`: per-user isolation, idempotent PUT/DELETE, 404 for invisible exercises, cascade on delete, flag on list / create / update / substitutes.
- Playwright: Exercises page (star, Favourites scope, search combos, rollback on failure, Polish search, phone layout) and picker in the workout and plan editor flows.

### Manual Testing Steps:

1. Star three exercises on the Exercises page; reload; confirm they persist.
2. Switch to Favourites, un-star one, check focus and the empty state after un-starring the last.
3. Search `lawce` with the language set to Polish; combine with Mine and a muscle filter; Clear filters.
4. Start a workout: search in the picker, pick a result, clear the search, confirm the selection and set logging still work.
5. Repeat the picker checks in the plan editor, then on a phone-width viewport.

## Performance Considerations

Lists are the catalog plus a user's custom exercises (tens to low hundreds of rows), filtered client-side on each keystroke; no debouncing needed. The list endpoint now does one extra indexed query for the user's favourite ids.

## Migration Notes

`V11__create_favorite_exercises.sql` is a new table only, no changes to existing data. Flyway applies it to the Supabase DB on the next deploy; never edit it once applied there. Rollback is dropping the table, which loses only favourites.

## References

- Change identity: `context/changes/favorite-exercises-search/change.md`
- Similar implementation: `frontend/src/pages/ExercisesPage.tsx:87-96` (client-side filters), `src/main/java/com/example/gymtrack/exercise/ExerciseController.java` (per-user endpoints)
- Style conventions: `CLAUDE.md` "UI conventions"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend favourites API

#### Automated

- [x] 1.1 Exercise tests pass, including migration V11 applying on a fresh container — e984e9d
- [x] 1.2 New authorization and cascade tests pass — e984e9d
- [x] 1.3 Full backend suite passes — e984e9d

#### Manual

- [x] 1.4 PUT then GET shows favorite true for that exercise only, and DELETE clears it — e984e9d

### Phase 2: Frontend foundation

#### Automated

- [x] 2.1 Unit tests pass, including the new helper tests and locale parity
- [x] 2.2 Type check and build pass
- [x] 2.3 Lint passes

### Phase 3: Exercises page

#### Automated

- [ ] 3.1 Build, lint and unit tests pass
- [ ] 3.2 No hard-coded values in the touched files
- [ ] 3.3 Exercises specs pass, including the existing ones

#### Manual

- [ ] 3.4 Star, filter and search look right in light and dark, in both languages, on a phone-width viewport
- [ ] 3.5 Keyboard: star is reachable, toggles with Space/Enter, focus ring visible, focus sensible after un-starring in Favourites

### Phase 4: Exercise picker

#### Automated

- [ ] 4.1 Build, lint, unit tests and token guard pass
- [ ] 4.2 Picker and regression specs pass
- [ ] 4.3 Full e2e suite passes with no baseline changes
- [ ] 4.4 Backend suite still green

#### Manual

- [ ] 4.5 On a phone-width viewport the search box, select, technique tooltip and Find substitute lay out cleanly
- [ ] 4.6 Typing in the picker search does not lose the selected exercise or in-progress set inputs
- [ ] 4.7 Light/dark and PL/EN look correct
