# Polish/English Internationalization Implementation Plan

## Overview

Make GymTrack usable in Polish and English. The UI is translated with `react-i18next`; the language defaults from the browser and the user's switcher choice is kept in localStorage. Server errors gain a stable `code` (the English `error` text stays), so the frontend translates them. The 40 preloaded exercises are translated in frontend locale files keyed by `slug`; custom exercises keep the name the user typed. No database change, so nothing has to be applied by hand to Supabase.

## Current State Analysis

- **Frontend** (`frontend/`, React 19, Vite 8, TS ~6, oxlint, no tests): about 20 `.tsx` files hold roughly 250 hardcoded English strings and there is no i18n library. Several strings need plural handling or inline links: `HistoryPage.tsx:107`, `PlansPage.tsx:58`, `LoginPage.tsx:62`, `RegisterPage.tsx:63`, `ProgressionRecommendation.tsx:40-44`.
- **Formatting** is hardcoded or duplicated: `utils/format.ts:12,16` (`'en-GB'`), `DashboardPage.tsx:18-29` (local copies of `formatDuration`/`formatVolume`), `PreviousWorkoutHint.tsx:17` (module-level `Intl.DateTimeFormat('en-GB')`, built once at import), `ProgressionChart.tsx:21`, `MyExercisesPage.tsx:30`.
- **Server errors**: every handler returns `{"error": "<English>"}` (`CommonExceptionHandler`, `AuthExceptionHandler`, `ExerciseExceptionHandler`, `WorkoutExceptionHandler`). `api/client.ts:16-26` surfaces `body.error` and about 25 pages render it directly. `authFetch` throws a plain `Error` (`client.ts:97`), so the `ApiError` 404 check in `HistoryDetailPage.tsx:30` can never be true today.
- **Exercise names**: seeded rows (40, `V2__create_exercises_and_seed.sql:15-54`) have a stable `slug` and NULL `owner_id`; custom ones get `custom-<uuid>`. Only `ExerciseResponse` exposes `slug`; `PlanEntryResponse` returns just `exerciseName`; workout/history DTOs return only IDs and the frontend joins against the exercise list.
- **Muscle groups** render as raw or title-cased enum values (`SubstituteSuggestions.tsx:67`, `MyExercisesPage.tsx:10-27`); no label map exists.
- **Settings**: `User` has no preferences (`UserResponse` is `id`, `email`). localStorage keys already follow `gymtrack.*` / `gymtrack_token`.
- **Deployment**: production runs with Flyway off and `ddl-auto=update` (`fly.toml:15-17`), which is why this plan avoids any schema change.

## Desired End State

A user whose browser language is Polish opens the app in Polish and can switch to English (and back) from the topbar, or from the login/register pages. Every label, button, empty state, aria-label, plural, date, duration and server error appears in the chosen language, as do the muscle-group labels and the names of the 40 preloaded exercises. Custom exercise names and plan names are shown exactly as typed. Exercise lists are alphabetical under the active language's rules. Missing translation keys, and seeded exercises without a Polish or English name, fail `npm test`.

### Key Discoveries:

- `authFetch` and the auth calls throw plain `Error` from `parseErrorMessage` (`frontend/src/api/client.ts:16-26,97`); making them throw `ApiError(status, code)` also repairs the dead 404 branch at `HistoryDetailPage.tsx:30`.
- All `WorkoutNotFoundException` and `PlanNotFoundException` extend `ResourceNotFoundException` and are mapped by one handler (`common/CommonExceptionHandler.java:17-20`), so "not found" codes need a code carried by the exception, not a new handler.
- Validation errors are built from the first field error only (`user/AuthExceptionHandler.java:13-21`). Jakarta's `FieldError.getCode()` already gives the constraint name, so no custom code per constraint is needed.
- 9 assertions in 4 backend test files check exact `error` text (`CustomExerciseVisibilityTest:218`, `TrainingPlanControllerTest:305,311`, `WorkoutSessionControllerTest:215,267`, `AuthControllerLoginTest:60,69`, `HistoryControllerTest:246,248`). Keeping `error` unchanged means they keep passing.
- Polish plurals have four categories (`one`, `few`, `many`, `other`), English two. A naive "identical keys" parity check would reject correct Polish files.
- `tsconfig.app.json` has `types: ["vite/client"]` and `erasableSyntaxOnly` (no enums), and `.oxlintrc.json` enables `only-export-components` as a warning.
- Seeded exercise lists are sorted by English `name` in seven repository queries (`ExerciseRepository.java:12-26,38-43,54`); the backend order is left alone and the frontend re-sorts.

## What We're NOT Doing

- No database migration, no `exercise_translations` table, no `name_pl` column, and no stored per-user language (so nothing to run manually on Supabase).
- No Spring `MessageSource` / `Accept-Language` negotiation, and no backend-side translation of any text.
- No translation of user-authored data: custom exercise names and plan names stay as typed.
- No third language, no right-to-left support, no lb/kg unit switching (`kg` stays a literal in both languages).
- No change to the server's duplicate-name check: it still compares against English seed names, so a custom exercise named like a Polish translation is allowed.
- No change to the exercise picker's UX (no regrouping by muscle group); only ordering by the active language.
- No change to `<title>` in `index.html` and no translation of developer-only errors (`AuthContext.tsx:73`, `JwtService`).

## Implementation Approach

Build the plumbing once (Phase 1), convert the screens in bulk by area while the backend is untouched (Phase 2), then add the backend error contract and make the frontend consume it (Phase 3), and finish with exercise and muscle-group names, which need a small backend DTO change and the shared name/sort helpers (Phase 4). Each phase leaves the app working: untranslated strings simply stay English, an unknown error code falls back to the English `error` text, and a missing exercise translation falls back to the stored name. That also makes deployment order between backend and frontend safe in either direction.

Conventions to follow throughout:
- Resources live in `frontend/src/i18n/locales/{en,pl}.json`, with keys grouped by area (`nav.*`, `auth.*`, `dashboard.*`, `errors.*`, `validation.*`, `exercises.*`, `muscle.*`, `common.*`). If JSON imports are not enabled under the current `tsconfig` (check `resolveJsonModule`), use `.ts` modules with the same shape.
- Keys are typed from the English resource through i18next's `CustomTypeOptions`, so `tsc -b` rejects unknown keys. Parity between `en` and `pl` is enforced by a test, since TypeScript cannot check it.
- Helpers that are not components read the i18n instance at call time rather than at import time; components calling `useTranslation()` re-render on language change.
- Keep non-component exports out of component files to avoid the `only-export-components` warning.

## Phase 1: i18n foundation

### Overview

Install and initialize i18n, add language detection, persistence and a switcher, make formatting locale-aware, and add the first frontend test runner with the locale parity test. Only the topbar navigation is converted here, as proof that the chain works end to end.

### Changes Required:

#### 1. Dependencies and scripts

**File**: `frontend/package.json`

**Intent**: Add `i18next` and `react-i18next` as dependencies and `vitest` (a version compatible with Vite 8) as a dev dependency, plus a `test` script.

**Contract**: `"test": "vitest run"`. No other script changes; `build` stays `tsc -b && vite build`.

#### 2. i18n initialization

**File**: `frontend/src/i18n/index.ts` (new), imported first in `frontend/src/main.tsx`

**Intent**: Initialize i18next synchronously with the bundled `en` and `pl` resources so the first render already has translations. Choose the initial language from `localStorage['gymtrack.lang']` when it holds `en` or `pl`, otherwise `pl` when `navigator.language` starts with `pl`, otherwise `en`. On every language change, write the choice to localStorage and set `document.documentElement.lang`.

**Contract**: Exports the configured instance as default and `SUPPORTED_LANGUAGES = ['en', 'pl'] as const`. All localStorage access is wrapped in try/catch (private windows). Fallback language is `en`. `main.tsx` imports `./i18n` before `App`.

#### 3. Typed keys

**File**: `frontend/src/i18n/i18next.d.ts` (new)

**Intent**: Declare `CustomTypeOptions` so `t()` keys are checked against the English resource at compile time.

**Contract**: `resources: { translation: typeof en }` with `defaultNS: 'translation'`. If key typing proves too restrictive for dynamic keys (`exercises.${slug}`, `errors.${code}`), type those through a small wrapper rather than loosening the global type.

#### 4. Language switcher

**File**: `frontend/src/components/LanguageSwitcher.tsx` (new); used in `Topbar.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`

**Intent**: A small control (select or two toggle buttons labelled "PL" / "EN") that calls `i18n.changeLanguage`. The topbar only renders for authenticated routes (`auth/RequireAuth.tsx:20-26`), so the login and register pages render the switcher themselves.

**Contract**: Reads the current language from `useTranslation()`; its own accessible name is translated.

#### 5. Topbar conversion

**File**: `frontend/src/components/Topbar.tsx`

**Intent**: Replace the nav labels (Dashboard, Workout, History, Plans, Exercises) and "Log out" with `t('nav.*')` keys, and place the switcher next to the logout button.

**Contract**: Adds `nav.*` keys to both locale files.

#### 6. Locale-aware formatting

**Files**: `frontend/src/utils/format.ts`, `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/PreviousWorkoutHint.tsx`, `frontend/src/components/ProgressionChart.tsx`, `frontend/src/components/RestTimer.tsx`

**Intent**: Make dates, numbers and durations follow the active language. Remove the duplicate `formatDuration`/`formatVolume` from `DashboardPage.tsx` in favour of the ones in `utils/format.ts` (swap imports only, to keep the diff small because `dashboard-insights` also touches this file). Replace the module-level `Intl.DateTimeFormat('en-GB')` in `PreviousWorkoutHint.tsx` with a call-time formatter. Turn the duration unit letters (`<1m`, `Xh Ym`) into translated strings.

**Contract**: `formatDate(iso)`, `formatVolume(kg)` and `formatDuration(seconds)` keep their current signatures and read `i18n.language` at call time. `kg` stays a literal. `RestTimer`'s `m:ss` stays mechanical.

#### 7. Locale parity test

**File**: `frontend/src/i18n/locales.test.ts` (new); `frontend/tsconfig.app.json` excludes `*.test.ts` from the app build (tests use `node:fs`, and the app config deliberately does not include Node types)

**Intent**: Fail when `pl` and `en` diverge. Flatten both resources into dotted keys and compare them after stripping plural suffixes (`_zero|_one|_two|_few|_many|_other`). For every base key that has plural forms in either file, require that each language defines all categories from `new Intl.PluralRules(lang).resolvedOptions().pluralCategories`.

**Contract**: The test is the single place where parity is enforced; later phases add keys without changing it.

### Success Criteria:

#### Automated Verification:

- Frontend installs and builds, typechecking included: `cd frontend && npm install && npm run build`
- Linting passes: `cd frontend && npm run lint`
- Locale parity test passes: `cd frontend && npm test`

#### Manual Verification:

- A switcher is visible in the topbar and on the login and register pages; switching changes the topbar labels immediately and the choice survives a reload
- With the browser language set to Polish and no stored choice, the app opens in Polish; with any other language it opens in English; `<html lang>` follows the selection
- Dashboard volume/duration and the "last time" date hint follow the selected language's formats, and the previous-workout date updates when the language is switched without reloading

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: UI string conversion by area

### Overview

Convert every remaining hardcoded user-facing string to translation keys, grouped by area, with Polish translations written alongside. Server error text and exercise names are intentionally still English here.

### Changes Required:

#### 1. Auth area

**Files**: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`

**Intent**: Translate headings, labels, button states ("Logging in…", "Registering…"), and fallback errors ('Login failed', 'Registration failed'). The "No account? Register" / "Already have an account? Log in" sentences contain a router `<Link>`, so they use `<Trans>` with the link as a component placeholder.

**Contract**: Keys under `auth.*`.

#### 2. Dashboard and history area

**Files**: `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/HistoryPage.tsx`, `frontend/src/pages/HistoryDetailPage.tsx`, `frontend/src/components/ProgressionChart.tsx`

**Intent**: Translate headings, tile labels, the time-window control and its aria-label, empty states (including the conditional ones at `HistoryPage.tsx:87-89`), pagination, "Unknown exercise", the "New personal record" aria-label, and chart text including the tooltip tuple at `ProgressionChart.tsx:78` and the `unit` prop.

**Contract**: `{n} sets` / `{n} workouts` and similar counts use i18next plural keys (`key_one`, `key_few`, `key_many`, `key_other` in `pl`; `_one`, `_other` in `en`) driven by `count`. Keep `kg` literal. Fallback strings such as `?? 'Failed to …'` become translated keys in this phase; their server-supplied counterpart is handled in Phase 3.

#### 3. Plans and exercises area

**Files**: `frontend/src/pages/PlansPage.tsx`, `frontend/src/pages/PlanEditorPage.tsx`, `frontend/src/pages/MyExercisesPage.tsx`, `frontend/src/components/PlanExerciseList.tsx`, `frontend/src/components/ExercisePicker.tsx`

**Intent**: Translate headings, labels, the delete-confirm flow, "Edit plan" / "New plan", "Saving…" / "Save", the exercise-count plural at `PlansPage.tsx:58`, and the interpolated aria-labels in `PlanExerciseList.tsx` ("Sets for {name}", "Move up", "Remove" and the rest), keeping the exercise name as an interpolation parameter.

**Contract**: Muscle-group labels are left to Phase 4; `MyExercisesPage` keeps its current `formatGroup` until then.

#### 4. Workout area and shared components

**Files**: `frontend/src/pages/WorkoutPage.tsx`, `frontend/src/components/SetLogger.tsx`, `frontend/src/components/SessionSetList.tsx`, `frontend/src/components/PlanWalkthrough.tsx`, `frontend/src/components/PreviousWorkoutHint.tsx`, `frontend/src/components/ProgressionRecommendation.tsx`, `frontend/src/components/RestTimer.tsx`, `frontend/src/components/SubstituteSuggestions.tsx`

**Intent**: Translate all remaining labels, buttons, aria-labels and empty states. `ProgressionRecommendation.tsx:40-44` is one long interpolated sentence with a plural on "workouts": make it a single key with `{weight}`, `{sets}`, `{reps}`, `{previousWeight}` and `{count}` parameters instead of concatenated fragments.

**Contract**: Do this area last in the phase. `WorkoutPage.tsx` has uncommitted edits from `personal-record-flag` in the working tree at planning time; land or commit those first, or rebase before touching the file.

### Success Criteria:

#### Automated Verification:

- Frontend builds and typechecks: `cd frontend && npm run build`
- Linting passes: `cd frontend && npm run lint`
- Locale parity test passes with all new keys, including Polish plural categories: `cd frontend && npm test`

#### Manual Verification:

- Walking through every screen in Polish shows no English text except server error messages, exercise names and muscle-group labels (all handled later)
- Plurals read correctly in Polish for counts 1, 2, 5 and 22 (sets, exercises, workouts) and correctly in English for 1 and 2
- Sentences with inline links ("No account? Register") render as working links in both languages
- Aria-labels and the chart tooltip are translated (inspect the DOM or use a screen reader) and update when the language is switched mid-session

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Backend error codes

### Overview

Add a stable `code` to every error response while keeping `error` as the English fallback, and make the frontend translate by code.

### Changes Required:

#### 1. Error code contract

**Files**: `src/main/java/com/example/gymtrack/common/` (new `ErrorCode` enum and a small helper that builds the error body), plus `ResourceNotFoundException.java`, `PlanNotFoundException.java`, `WorkoutNotFoundException.java`, `EmailAlreadyExistsException.java`, `InvalidCredentialsException.java`, `ExerciseConflictException.java`, `WorkoutConflictException.java`, `InvalidDashboardWindowException.java`, `InvalidHistoryQueryException.java` and their throw sites

**Intent**: Each exception carries its `ErrorCode` so handlers can emit it. This keeps the single not-found handler working for three different "not found" messages.

**Contract**: Response body becomes `{"error": "<unchanged English text>", "code": "<CODE>"}` for every handler. Codes: `EXERCISE_NOT_FOUND`, `PLAN_NOT_FOUND`, `WORKOUT_NOT_FOUND`, `SET_NOT_FOUND`, `MALFORMED_BODY`, `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `EXERCISE_NAME_TAKEN`, `EXERCISE_IN_USE`, `WORKOUT_ALREADY_ACTIVE`, `WORKOUT_ENDED`, `INVALID_DASHBOARD_WINDOW`, `INVALID_HISTORY_PAGE`, `INVALID_HISTORY_SIZE`, `INVALID_HISTORY_FILTER`, `INVALID_PARAMETER`, `VALIDATION_FAILED`. Status codes and `error` strings do not change. Note the two "Exercise not found" paths: `WorkoutNotFoundException` is also thrown for a missing exercise at `PreviousWorkoutService:31`, `ProgressionRecommendationService:52` and `WorkoutService:101,126`, so those throw sites must pass `EXERCISE_NOT_FOUND`.

#### 2. Handler updates

**Files**: `common/CommonExceptionHandler.java`, `user/AuthExceptionHandler.java`, `exercise/ExerciseExceptionHandler.java`, `workout/WorkoutExceptionHandler.java`

**Intent**: Emit `code` for every mapped exception. For `MethodArgumentTypeMismatchException` use `INVALID_PARAMETER` with the parameter name as `field`.

**Contract**: Validation responses add `field` and `rule`: `{"error": "<existing text>", "code": "VALIDATION_FAILED", "field": "<field>", "rule": "<constraint name from FieldError.getCode(), e.g. NotBlank, Email, Size, Min, Max, DecimalMin, AssertTrue, HalfKgStep>"}`. Still first field error only. This covers the two custom messages (`CreateExerciseRequest.java:24`, `HalfKgStep.java:17`) without bespoke codes; verify the actual `rule` values they produce in a test before writing the Polish strings.

#### 3. Backend tests

**Files**: the controller tests listed under Key Discoveries, plus tests for the validation payload

**Intent**: Assert `code` (and for validation `field`/`rule`) alongside the existing `error` assertions, which must keep passing unchanged. Cover at least one case per code that is reachable through an existing test file.

**Contract**: No existing assertion on `error` text is edited.

#### 4. Frontend error handling

**Files**: `frontend/src/api/client.ts`, a new `frontend/src/utils/errors.ts`, every page and component that renders `err.message` (see list in Current State), locale files

**Intent**: Make `parseErrorMessage`, the auth calls and `authFetch` throw `ApiError` carrying `status`, `code`, `field`, `rule` and the English `message`. Add one `translateError(err, fallbackKey)` helper that returns `t('errors.<code>')` for known codes, `t('validation.<rule>', { field })` for `VALIDATION_FAILED` with a known rule, and otherwise the existing English message or the page's translated fallback. Replace direct `err.message` rendering with it.

**Contract**: `ApiError extends Error` with `status: number`, `code?: string`, `field?: string`, `rule?: string`. Throwing `ApiError` from `authFetch` activates the 404 branch in `HistoryDetailPage.tsx:30`, which is intended; confirm that page now shows its "Workout not found" state. `translateError` never throws on an unknown code.

### Success Criteria:

#### Automated Verification:

- Backend tests pass, including the new `code` assertions: `./mvnw test`
- Frontend builds and typechecks: `cd frontend && npm run build`
- Linting passes: `cd frontend && npm run lint`
- Locale parity test passes with the new `errors.*` and `validation.*` keys: `cd frontend && npm test`

#### Manual Verification:

- Logging in with a wrong password shows the Polish message in Polish and the English message in English
- Registering with an invalid email or empty password shows a translated, field-aware validation message
- Opening a non-existent history entry (e.g. `/history/<random-uuid>`) shows the translated "workout not found" state
- Unknown code or missing `code` (point the frontend at a response without it, or temporarily rename a key) falls back to the English `error` text instead of crashing

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Exercise and muscle-group names

### Overview

Translate the 40 preloaded exercise names and the muscle-group labels, and order exercise lists by the active language.

### Changes Required:

#### 1. Expose the slug on plan entries

**Files**: `src/main/java/com/example/gymtrack/plan/PlanEntryResponse.java`, `PlanResponse.java`, `TrainingPlanService.java` (`loadExerciseNames`, around lines 75-79), `frontend/src/api/client.ts` (plan entry type, around line 274)

**Intent**: Return the exercise `slug` next to `exerciseName` on every plan entry so the frontend can translate seeded exercises in plans.

**Contract**: New field `exerciseSlug` on `PlanEntryResponse`, populated for every entry (custom exercises carry `custom-<uuid>`). The existing `exerciseName` field is unchanged. A backend test asserts the field.

#### 2. Name and sort helpers

**File**: `frontend/src/utils/exercises.ts` (new)

**Intent**: One place that turns an exercise into its display name and sorts lists for the active language.

**Contract**: `exerciseName({ slug, name })` returns `t('exercises.<slug>')` when `i18n.exists` for that key, otherwise `name`. Custom slugs never match a key, so no separate `custom` check is needed. `sortExercisesByName(list)` sorts by `exerciseName` using `localeCompare(…, i18n.language)`.

#### 3. Use the helpers everywhere an exercise name is rendered

**Files**: `components/ExercisePicker.tsx:24`, `components/SubstituteSuggestions.tsx:66,72`, `pages/MyExercisesPage.tsx:30,180`, `pages/HistoryDetailPage.tsx:72,90`, `pages/WorkoutPage.tsx:58`, `components/SessionSetList.tsx:30`, `pages/PlanEditorPage.tsx:46,74`, `components/PlanExerciseList.tsx:34-81`, `components/PlanWalkthrough.tsx:42`

**Intent**: Replace direct `exercise.name` / `exerciseName` use with the helper, and keep `slug` available where the name is currently copied into state (plan editor entries, the name maps in workout and history pages). Sort picker, alternatives and exercise lists with `sortExercisesByName`.

**Contract**: Interpolated aria-labels receive the already-translated name. Plan names and custom exercise names are not translated.

#### 4. Muscle-group labels

**Files**: new `frontend/src/utils/muscleGroups.ts`, `pages/MyExercisesPage.tsx:10-27,138-156,182-184`, `components/SubstituteSuggestions.tsx:67`

**Intent**: Move the `MUSCLE_GROUPS` list and `formatGroup` into one module as an `as const` array (no enums: `erasableSyntaxOnly`), and replace `formatGroup` with a `muscleGroupLabel(group)` that returns `t('muscle.<GROUP>')`. Use it in both places, including `SubstituteSuggestions`, which currently prints the raw enum.

**Contract**: Keys `muscle.CHEST`, `BACK`, `SHOULDERS`, `BICEPS`, `TRICEPS`, `QUADS`, `HAMSTRINGS`, `GLUTES`, `CALVES`, `CORE` in both locale files.

#### 5. Exercise translations and the slug test

**Files**: `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/pl.json`, `frontend/src/i18n/locales.test.ts`

**Intent**: Add an `exercises.<slug>` entry for each of the 40 seeded slugs in both files (English values copy the seed names; Polish values are the translations, to be reviewed by someone who trains). Extend the test to read the seed slugs and fail when any is missing from either file.

**Contract**: The test reads `../src/main/resources/db/migration/*.sql` from the repository (outside the Vite root, via `node:fs`), collects the slugs from every `insert into exercises` statement, and asserts each has `exercises.<slug>` in `en` and `pl`. A future migration that seeds a new exercise therefore fails the test until both languages are added.

### Success Criteria:

#### Automated Verification:

- Backend tests pass, including the `exerciseSlug` assertion: `./mvnw test`
- Frontend builds and typechecks: `cd frontend && npm run build`
- Linting passes: `cd frontend && npm run lint`
- Locale parity and seed-slug tests pass: `cd frontend && npm test`

#### Manual Verification:

- In Polish, the exercise picker, alternatives, plans (editor and list), active workout, set list and history detail show Polish names for preloaded exercises, sorted by Polish alphabetical rules (including "Ł", "Ś", "Ż")
- A custom exercise and a plan keep the exact name the user typed in both languages
- Muscle groups are labelled in both languages in My Exercises and Alternatives, with no raw uppercase enum text left anywhere
- Someone who trains reviews the Polish exercise names and flags any non-standard term

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Locale parity (keys equal modulo plural suffixes; all CLDR plural categories present per language) and seed-slug coverage, both in `locales.test.ts`
- Backend controller tests: `code` for each error, `field`/`rule` for validation, `exerciseSlug` on plan entries

### Integration Tests:

- Existing backend controller tests keep passing unchanged against the extended error body
- Optional follow-up: add a tiny `translateError` unit test (known code, unknown code, validation with rule) if the implementer finds it cheap

### Manual Testing Steps:

1. Fresh profile with the browser language set to Polish: app opens in Polish; switch to English and reload, and the choice persists
2. Walk every route in both languages, checking plurals at 1, 2, 5, 22, and that long Polish strings don't break the mobile layout
3. Trigger one error of each kind (wrong password, duplicate custom exercise name, deleting an exercise in use, second active workout) and read it in both languages
4. Create a custom exercise and a plan with Polish and English names and confirm they display verbatim

## Performance Considerations

Resources are bundled (about 250 UI strings and 40 exercise names per language), so there is no extra network request and no lazy-loading. The two locale files add a few tens of KB before gzip at most. Sorting happens client-side on lists of a few dozen items.

## Migration Notes

None for data. Because Flyway is disabled in production and this plan adds no schema, there is no manual SQL to run on Supabase. Backend and frontend can ship in either order: a frontend without a `code` falls back to the English `error`, and a missing `exerciseSlug` falls back to the stored name. Any future migration that seeds a new exercise must add its slug to both locale files (enforced by the Phase 4 test).

## References

- Related research: none (planning-time exploration only)
- Error handling today: `src/main/java/com/example/gymtrack/common/CommonExceptionHandler.java:17-25`, `user/AuthExceptionHandler.java:13-31`, `workout/WorkoutExceptionHandler.java:17-35`
- Frontend error plumbing: `frontend/src/api/client.ts:16-26,75-98`
- Seed data: `src/main/resources/db/migration/V2__create_exercises_and_seed.sql:15-54`
- In-flight changes touching the same files: `context/changes/personal-record-flag/` (WorkoutPage.tsx, workout services), `context/changes/dashboard-insights/` (DashboardPage.tsx)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: i18n foundation

#### Automated

- [x] 1.1 Frontend installs and builds, typechecking included — 67920b9
- [x] 1.2 Frontend linting passes — 67920b9
- [x] 1.3 Locale parity test passes — 67920b9

#### Manual

- [x] 1.4 Switcher is visible on topbar, login and register; switching changes topbar labels immediately and survives reload — 67920b9
- [x] 1.5 Browser language selects the initial language and `<html lang>` follows the selection — 67920b9
- [x] 1.6 Dashboard and previous-workout date/number/duration formats follow the selected language, including on a live switch — 67920b9

### Phase 2: UI string conversion by area

#### Automated

- [x] 2.1 Frontend builds and typechecks
- [x] 2.2 Frontend linting passes
- [x] 2.3 Locale parity test passes with all new keys and Polish plural categories

#### Manual

- [x] 2.4 Every screen in Polish shows no English except server errors, exercise names and muscle-group labels
- [x] 2.5 Plurals read correctly in Polish (1, 2, 5, 22) and English (1, 2)
- [x] 2.6 Inline-link sentences render as working links in both languages
- [x] 2.7 Aria-labels and chart tooltip are translated and update on live language switch

### Phase 3: Backend error codes

#### Automated

- [ ] 3.1 Backend tests pass, including the new code assertions
- [ ] 3.2 Frontend builds and typechecks
- [ ] 3.3 Frontend linting passes
- [ ] 3.4 Locale parity test passes with the new errors and validation keys

#### Manual

- [ ] 3.5 Wrong password shows the translated message in both languages
- [ ] 3.6 Invalid registration input shows a translated, field-aware validation message
- [ ] 3.7 A non-existent history entry shows the translated not-found state
- [ ] 3.8 A response with an unknown or missing code falls back to the English error text

### Phase 4: Exercise and muscle-group names

#### Automated

- [ ] 4.1 Backend tests pass, including the exerciseSlug assertion
- [ ] 4.2 Frontend builds and typechecks
- [ ] 4.3 Frontend linting passes
- [ ] 4.4 Locale parity and seed-slug tests pass

#### Manual

- [ ] 4.5 Polish exercise names appear and sort correctly in picker, alternatives, plans, workout and history
- [ ] 4.6 Custom exercise and plan names are shown verbatim in both languages
- [ ] 4.7 Muscle groups are labelled in both languages with no raw enum text left
- [ ] 4.8 A lifter has reviewed the Polish exercise names
