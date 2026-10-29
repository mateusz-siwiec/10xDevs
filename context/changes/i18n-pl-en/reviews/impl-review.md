<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Polish/English Internationalization

- **Plan**: context/changes/i18n-pl-en/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated criteria re-run: `./mvnw test` PASS; `npm run build` PASS; `npm run lint` PASS (2 pre-existing AuthContext warnings); `npm test` PASS (9 tests). All Manual rows in Progress are `[x]` with a phase commit SHA.

## Findings

### F1 — Error banners keep the language they were created in

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/DashboardPage.tsx:75,95; HistoryPage.tsx:60; HistoryDetailPage.tsx:40; ProgressionChart.tsx:44; SubstituteSuggestions.tsx:43; WorkoutPage/PlansPage/MyExercisesPage/PlanEditorPage `setError(translateError(...))`
- **Detail**: Pages store the already-translated string in state. Switching language while an error is shown leaves the banner in the old language until the next fetch. Plan Phase 2 manual criterion asks that translated text update on a live switch.
- **Fix**: Store the raw error (`unknown`) in state and call `translateError` at render time.
  - Strength: banners follow `useTranslation()` re-renders; no new mechanism.
  - Tradeoff: touches ~9 files; state types change from string to unknown.
  - Confidence: HIGH — translateError already reads i18n at call time.
  - Blind spot: pages that combine error with other derived text were not all inspected.
- **Decision**: FIXED

### F2 — Seeded exercise names stay English on the dashboard (RecentRecords)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: frontend/src/components/RecentRecords.tsx:27; src/main/java/com/example/gymtrack/workout/DashboardInsightsResponse.java:23
- **Detail**: `RecentPersonalRecord` has no slug, so `record.exerciseName` is rendered as stored. The desired end state says names of the 40 preloaded exercises appear in the chosen language everywhere.
- **Fix A ⭐ Recommended**: Look the exercise up on the frontend by `exerciseId` and use `exerciseName`.
  - Strength: no backend change.
  - Tradeoff: needs the exercise list on the dashboard (one extra fetch or shared cache).
  - Confidence: MEDIUM — depends on whether DashboardPage already loads exercises.
  - Blind spot: not checked how DashboardPage loads data.
- **Fix B**: Add `exerciseSlug` to `RecentPersonalRecord` and its query.
  - Strength: same pattern as plan entries in Phase 4.
  - Tradeoff: backend DTO + test change.
  - Confidence: HIGH — mirrors Phase 4 item 1.
  - Blind spot: query projection effort not estimated.
- **Decision**: FIXED via Fix A

### F3 — Translated message can resolve to a non-string

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/utils/errors.ts:11-13,34-36
- **Detail**: `i18n.exists('validation.fields')` is true for namespace objects, so a server `rule` or `code` such as `fields` yields an object; React throws when rendering it.
- **Fix**: In `lookup`, require `typeof result === 'string'` (and add a test for a `fields` rule).
- **Decision**: FIXED

### F4 — Dates/numbers in two dashboard components ignore the app language

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/components/RecentRecords.tsx:12; WeeklyVolumeChart.tsx:13,17,44
- **Detail**: `toLocaleDateString(undefined, …)` follows the browser locale. Switching the app to PL in an English browser leaves these in en formats (Phase 1 intent: formats follow the selected language).
- **Fix**: Use `formatDate`/number helpers from utils/format.ts, or pass `i18n.language`.
- **Decision**: FIXED

### F5 — Leftover hardcoded English strings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: RecentRecords.tsx:29 and SessionSetList.tsx:44 (`PR` badge); api/client.ts:52 (`Request failed with status N`, also what a 401 without a body shows)
- **Detail**: The plan requires every label translated; the `PR` badge and the generic non-JSON fallback reach the UI untranslated.
- **Fix**: Add a `common.prBadge` key; make `translateError` map an `ApiError` without code to a translated generic key (e.g. `errors.REQUEST_FAILED`).
- **Decision**: FIXED

### F6 — Translated validation messages drop constraint bounds

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/i18n/locales/en.json:279-287; user/AuthExceptionHandler.java
- **Detail**: English server text says e.g. "size must be between 8 and 72"; the translated Size/Min/Max strings say only "invalid length / too small".
- **Fix**: Accept and note it, or later add min/max to the error body.
- **Decision**: FIXED

### F7 — Test gaps around error codes

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/src/i18n/locales.test.ts; frontend/src/utils/errors.test.ts
- **Detail**: Nothing checks that every `ErrorCode` enum value has an `errors.*` key (all 19 do today), and `HalfKgStep`'s rule value is asserted nowhere.
- **Fix**: Extend locales.test.ts to parse ErrorCode.java; add a HalfKgStep validation test.
- **Decision**: FIXED

### F8 — format.ts locale handling inconsistent

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/utils/format.ts
- **Detail**: `formatDate` maps `pl` to `pl-PL` else `en-GB`; `formatVolume` passes `i18n.language` directly.
- **Fix**: Use one shared locale-resolver helper.
- **Decision**: FIXED

### F9 — PlanResponse.from dereferences exercise without guard

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/plan/PlanResponse.java:15
- **Detail**: The old code tolerated a missing name; the new code NPEs if a caller passes a partial map. All current callers pass full maps.
- **Fix**: Skip or fail with a clear message if the exercise is absent.
- **Decision**: FIXED

### F10 — Network errors show the browser's English text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/utils/errors.ts:37
- **Detail**: `translateError` returns `err.message` for any `Error`, so `TypeError: Failed to fetch` is shown untranslated; the page fallback is used only for non-Error values. Within the plan's wording but weak UX.
- **Fix**: Use the translated fallback for non-ApiError errors.
- **Decision**: FIXED
