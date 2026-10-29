# Polish/English Internationalization — Plan Brief

> Full plan: `context/changes/i18n-pl-en/plan.md`

## What & Why

Make GymTrack usable in Polish and English: all UI text, dates and durations, server errors, and the names of the 40 preloaded exercises. The product notes are in Polish and the user base is expected to be Polish-speaking, but the app is English-only today.

## Starting Point

The frontend has about 250 hardcoded English strings across 20 files and no i18n library. Dates are pinned to `en-GB`. Every server error is `{"error": "<English>"}` and about 25 places show it verbatim. Preloaded exercises carry a stable `slug` and an English name; muscle groups render as raw enum values. Production runs Flyway-off, so schema changes would need hand-applied SQL.

## Desired End State

The app opens in Polish for Polish browsers and English otherwise, with a switcher in the topbar and on the login/register pages. Every label, plural, date, error, muscle group and preloaded exercise name follows the chosen language; custom exercises and plan names appear exactly as typed. A missing translation key, or a seeded exercise without both names, fails `npm test`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Language selection | Browser language default, choice kept in localStorage `gymtrack.lang` | No backend or DB change and it matches the existing `gymtrack.restDuration` pattern. |
| Server errors | Add a stable `code`, keep the English `error` | Backwards compatible; existing tests keep passing and the frontend can fall back to the English text. |
| Validation errors | `VALIDATION_FAILED` plus `field` and `rule` (Jakarta constraint name) | Reuses the same mechanism and avoids a bespoke code per constraint. |
| Preloaded exercise names | Frontend locale files keyed by `slug`, fallback to stored name | No migration and nothing to run on Supabase; custom exercises fall back naturally. |
| Ordering | Re-sort on the frontend with `localeCompare(…, lang)` | Gives correct Polish order without touching seven backend queries. |
| Tests | Add Vitest: key-parity (plural-aware) and seed-slug coverage tests | The repo has no frontend tests and a forgotten key is the main failure mode. |
| Phasing | Foundation → UI by area → backend codes → exercise names | Each phase is shippable alone; the workout area (pending edits) comes late. |

## Scope

**In scope:** `react-i18next` setup and switcher; locale-aware formatting; all UI strings including plurals and aria-labels; backend `code`/`field`/`rule` on errors and frontend translation; `exerciseSlug` on plan entries; Polish/English names for 40 seeded exercises; muscle-group labels; Vitest parity tests.

**Out of scope:** DB migrations or translation tables; per-user stored language; Spring `MessageSource` / `Accept-Language`; translating custom exercise or plan names; a third language; lb/kg switching; changing the server's duplicate-name check; regrouping the exercise picker.

## Architecture / Approach

The backend stays language-neutral: it returns English `error` text plus a stable `code` (and `field`/`rule` for validation) and a `slug` for exercises. The frontend owns every translation. `i18n/index.ts` initializes i18next synchronously with bundled `en`/`pl` JSON; a `translateError` helper maps codes to messages with an English fallback, and `exerciseName` / `sortExercisesByName` map slugs to display names and order lists per language. Any missing code or translation degrades to the English text, so frontend and backend can deploy in either order.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. i18n foundation | i18next setup, detection, persistence, switcher, locale-aware formatters, Vitest + parity test | First frontend test runner; TS config (`erasableSyntaxOnly`, JSON imports, Node types) may need adjustment |
| 2. UI string conversion by area | All screens and components translated, with plurals and `<Trans>` links | Breadth (about 250 strings) and conflicts with in-flight edits in `WorkoutPage.tsx` / `DashboardPage.tsx` |
| 3. Backend error codes | `code` on all errors, validation payload, `ApiError` in the client, translated errors | Missing a throw site (e.g. the exercise-not-found paths that use `WorkoutNotFoundException`) |
| 4. Exercise and muscle-group names | `exerciseSlug` on plan entries, name/sort helpers, 40 Polish names, muscle labels, slug test | Polish translation quality and duplicate-name edge cases |

**Prerequisites:** Land or commit the `personal-record-flag` edits (they touch `WorkoutPage.tsx` and the workout services) before Phase 2's workout area; coordinate with `dashboard-insights`, which also touches `DashboardPage.tsx`.
**Estimated effort:** About 4 sessions, one per phase; Phase 2 is the longest.

## Open Risks & Assumptions

- The 40 Polish exercise names need review by someone who trains; terminology varies.
- A custom exercise named like a Polish translation of a seed exercise is allowed, because the duplicate check compares English names only.
- With a Polish `Accept-Language`, Jakarta validation default text may come back in Polish inside `error`; the UI uses `code`/`rule`, so this only affects the fallback.
- `resolveJsonModule` and Node types in the app tsconfig are unverified; the plan allows `.ts` locale modules and excludes tests from the app build as fallbacks.
- No frontend component tests exist; completeness of Phase 2 depends on the manual Polish walkthrough.

## Success Criteria (Summary)

- A Polish-browser user sees a fully Polish app, can switch to English and back, and the choice persists.
- Server errors, plurals, dates, muscle groups and the 40 preloaded exercise names are translated, with custom data shown verbatim.
- `./mvnw test`, `npm run build`, `npm run lint` and `npm test` pass, and forgetting a key or a seeded exercise translation fails the build checks.
