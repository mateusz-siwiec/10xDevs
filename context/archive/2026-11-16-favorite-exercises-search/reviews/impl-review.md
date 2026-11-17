<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Favourite exercises and text search

- **Plan**: context/changes/favorite-exercises-search/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS (approved deviations: `picker.filterLabel` key, 4 win32 baselines refreshed) |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated criteria re-run during review: frontend build, lint (0 errors), unit tests (57), `check:tokens`, backend exercise tests (37). Full e2e (72) and full backend suite (223) passed at the end of Phase 4.

## Findings

### F1 — Picker announces "no matches" when nothing was searched

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/ExercisePicker.tsx:64
- **Detail**: The hint shows whenever `matches.length === 0`, including an empty exercise list with an empty query (e.g. exercises failed to load), so it announces "No exercises match your search." although the user never searched.
- **Fix**: Show the hint only when `query.trim() !== '' && matches.length === 0`.
- **Decision**: FIXED via Fix now (hint only when the query is non-empty)

### F2 — Favourite toggle: no re-entry guard, rollback focus can go stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/pages/ExercisesPage.tsx:85-103
- **Detail**: Two clicks in the same tick can both pass the `disabled` check (disabled is applied after the state flush); results stay correct because PUT/DELETE are idempotent, but the first request's `finally` re-enables the star early. Also, if the scope changes while a request is in flight and it then fails, `pendingFocus = {kind:'star'}` may point at a row that no longer renders and is consumed by an unrelated later update.
- **Fix**: Return early from `toggleFavorite` when `favoriteBusy.has(id)` (use a ref), and clear `pendingFocus` in `finally` when the target row is not rendered.
- **Decision**: FIXED via Fix now (in-flight ref guard; the stale-pendingFocus part needed no change because the focus effect consumes pendingFocus on the rollback render)

### F3 — Dead i18n key `exercises.picker.searchLabel`

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/i18n/locales/en.json, pl.json (`exercises.picker.searchLabel`)
- **Detail**: Planned key, but the picker uses `picker.filterLabel` (to avoid clashing with `getByLabel('Exercise')` locators). The old key is unused.
- **Fix**: Remove `picker.searchLabel` from both locale files.
- **Decision**: FIXED via Fix now (key removed from en and pl)

### F4 — Picker filter is O(n²) per render

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/ExercisePicker.tsx:25-27
- **Detail**: `matches.includes(exercise)` inside a filter. Negligible at catalogue size.
- **Fix**: Filter once with `exercise.id === selectedId || matchesExerciseSearch(exercise, query)`; drop the separate `matches` pass (keep a count/some for the hint).
- **Decision**: FIXED via Fix now (single Set-based pass)

### F5 — Linux workout-ui baselines are stale

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: frontend/e2e/workout-ui.spec.ts-snapshots/*-linux.png
- **Detail**: Only the four win32 baselines were refreshed (user-approved, intentional delta: new filter field). The linux baselines used by CI still show the old layout, so Linux CI will fail `workout-ui` until regenerated.
- **Fix**: Regenerate the four linux baselines on Linux/CI (`playwright test workout-ui --update-snapshots`) and commit them.
- **Decision**: SKIPPED (linux baselines to be regenerated on Linux/CI)

### F6 — Empty Favourites state lacks the star hint

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/pages/ExercisesPage.tsx (noFavorites message)
- **Detail**: Plan said "with the star hint"; text is only "No favourite exercises yet."
- **Fix**: Extend `exercises.noFavorites` (EN/PL) to "No favourite exercises yet. Star an exercise to add it here."
- **Decision**: FIXED via Fix now (en and pl text extended)
