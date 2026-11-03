---
project: "GymTrack"
version: 1
status: draft
created: 2026-10-29
prd_version: 1
---

# Test plan: GymTrack

> Risk-driven: each section names a concrete way the product can fail the user, then the tests that
> guard it. Risks come from the PRD guardrails (`prd.md` > Success Criteria > Guardrails) and from the
> business rules in `README.md` > Business logic.

## How the tests are layered

| Layer | Tooling | Runs | What it proves |
| --- | --- | --- | --- |
| Backend integration | JUnit + Spring `MockMvc` + Testcontainers (real Postgres 16, real Flyway migrations) | `./mvnw test`, CI job *Backend tests* | HTTP contract, per-user scoping, business rules, DB constraints |
| Frontend unit | Vitest | `npm test` in `frontend/`, CI job *Frontend* | Locale files stay in sync, error mapping |
| End-to-end | Playwright (Chromium) against the real backend + Vite | `npm run test:e2e` in `frontend/`, CI job *End-to-end* | What a user sees in the browser, through the whole stack |
| Manual release check | Checklist below | Before a review/demo | Deployment availability, which no automated test covers |

There are no mocks of the database: integration tests run the same Flyway migrations as production
against a throwaway Postgres container, so schema drift fails the build.

## Risks and the tests that cover them

### R1. One user sees another user's data (guardrail)

**Impact:** critical. Training data is personal; leaking it breaks the core trust guardrail.
**Where it could happen:** any endpoint taking an id (plan, session, set, custom exercise).

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/data-isolation.spec.ts` | E2E | A second user, browsing the UI, sees no foreign plan or custom exercise, and a guessed plan id returns 404 |
| `CustomExerciseVisibilityTest` | Backend | A foreign custom exercise is 404 on every exercise-id path; substitutes list only the caller's own custom exercises |
| `TrainingPlanControllerTest.otherUserGetsNotFoundOnGetPutDelete`, `listReturnsOnlyCallersPlans…` | Backend | Plans are scoped to the owner |
| `WorkoutSessionControllerTest.otherUserCannotEndSession`, `startWithForeignPlanReturnsNotFound…` | Backend | Sessions and plan references are scoped |
| `WorkoutSetControllerTest.otherUserGetsNotFoundOnLogAndDelete` | Backend | Sets are scoped |
| `ProgressionRecommendationControllerTest.otherUsersSessionsNeverLeak`, `DashboardInsightsControllerTest.otherUsersDataNeverLeaks` | Backend | Derived data (recommendations, dashboard) never mixes users |

Not-found (404) rather than forbidden (403) is deliberate: the API does not confirm that a foreign id exists.

### R2. The weight recommendation is wrong or unsafe (core business rule)

**Impact:** high. The product's value is a trustworthy, deterministic suggestion; a wrong jump could
push a user to an unsafe weight.

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/progression-recommendation.spec.ts` | E2E | Two full workouts at 60 kg produce "Try 61.5 kg" on the workout screen |
| `ProgressionRecommendationControllerTest` (17 cases) | Backend | The rule's boundaries: needs 2 ended sessions; a short set count, a rep below target, or differing top weights break it; warm-up sets do not; sessions without a plan break the streak; rounding to 0.5 kg with a minimum +0.5 kg step; suppression above 1000 kg; the first plan entry is the target when an exercise appears twice |

### R3. A logged set is lost, duplicated or attached to the wrong session (guardrail)

**Impact:** high. "A logged set is never lost or silently overwritten."

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/log-set.spec.ts` | E2E | Register, start, log a set, end, and find it in History |
| `WorkoutSetControllerTest` | Backend | A logged set appears in the active session; invalid values are rejected; ended sessions refuse new or deleted sets |
| `WorkoutSessionControllerTest.concurrentStartsYieldOneCreatedAndSameSession` | Backend | Two simultaneous "start workout" requests create exactly one session (partial unique index) |
| `WorkoutSchemaTest`, `TrainingPlanSchemaTest` | Backend | DB constraints behind those guarantees: one active session per user, no zero reps or weight, cascades on delete, no duplicate plan positions |

### R4. Unauthenticated access to protected data

**Impact:** critical.

| Test | Level | Covers |
| --- | --- | --- |
| `*ControllerTest.*WithoutTokenReturnsUnauthorized` (every controller) | Backend | Every protected route rejects requests without a token |
| `UserControllerMeTest` | Backend | Missing or garbage tokens are 401; a valid token returns the caller's own identity |
| `JwtServiceTest` | Backend | A token round-trips to its claims; a token signed with another key or an expired token is rejected |
| `AuthControllerLoginTest`, `AuthControllerRegisterTest` | Backend | Wrong password and unknown email return the same error body (no account enumeration); duplicate emails are rejected case-insensitively; short passwords and malformed emails are rejected |

### R5. Personal records flagged incorrectly

**Impact:** medium. A false "PR" badge erodes trust in the numbers.

| Test | Level | Covers |
| --- | --- | --- |
| `PersonalRecordControllerTest` | Backend | First set is not a record; a higher estimated 1RM is; ties are not; sets above 15 reps are ignored; exercises are independent; log response, History and Dashboard agree; deleting a set re-judges later ones |
| `DashboardInsightsControllerTest` (records cases) | Backend | The dashboard's recent records match the flags in History |

### R6. Dashboard numbers and streak are wrong

**Impact:** medium.

| Test | Level | Covers |
| --- | --- | --- |
| `DashboardControllerTest` | Backend | Workout count, duration and volume per 7/30/90-day or all-time window, with the previous period for comparison |
| `DashboardInsightsControllerTest` | Backend | 12 weekly blocks incl. zero weeks; week-edge placement; streak with and without the current week; goal validation (1 to 14 or null) |

### R7. Invalid input corrupts data or crashes the API

**Impact:** medium.

| Test | Level | Covers |
| --- | --- | --- |
| `WorkoutSetControllerTest.logSetWithInvalidValues…`, `…NonHalfKgWeight…` | Backend | Reps 1 to 100, weight above 0 up to 1000 in 0.5 kg steps |
| `TrainingPlanControllerTest.invalidRequestsReturnBadRequest`, `CustomExerciseControllerTest` | Backend | Name length, entry counts and set/rep ranges, duplicate exercise names |
| `ExerciseControllerTest.unknownMuscleGroupReturnsBadRequest` | Backend | Bad filter values give a clean 400 with an error body |

### R8. A deploy breaks the production schema

**Impact:** high. Flyway migrations run against Supabase on every startup.

| Test | Level | Covers |
| --- | --- | --- |
| Every Testcontainers-based test (the whole backend suite) | Backend | Every migration applies cleanly to an empty DB, then Hibernate `validate` confirms the entities match it |
| CI on every PR | CI | The above runs before anything can merge to `main` |

### R9. Missing translations

**Impact:** low. A Polish user sees raw keys.

| Test | Level | Covers |
| --- | --- | --- |
| `frontend/src/i18n/locales.test.ts` | Frontend unit | `en` and `pl` locale files have identical keys |
| `frontend/src/utils/errors.test.ts` | Frontend unit | Server error codes map to translated messages |

### R10. A workout is deleted by accident, or deletion leaves orphans or another user's data touched

**Impact:** medium. Deleting is permanent (PRD: destructive actions need explicit confirmation).

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/delete-workout.spec.ts` | E2E | Delete needs a second click to confirm; Cancel keeps the workout; Confirm removes it from History and the API returns 404 |
| `WorkoutSetControllerTest.deleteSessionRemovesItAndItsSetsFromHistory`, `deletingTheActiveSessionLetsTheUserStartANewOne` | Backend | The session and its sets are gone (including from progression data); deleting an active session frees the user to start a new one |
| `WorkoutSetControllerTest.otherUserCannotDeleteSessionAndItSurvives`, `deleteSessionWithoutTokenReturnsUnauthorized` | Backend | Another user gets 404 and the workout survives; no token gives 401 |

### R11. Per-muscle-group set counts are wrong or leak another user's data

**Impact:** medium. The page exists to reveal training imbalance; a wrong count misleads the user.

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/muscle-group-stats.spec.ts` | E2E | From the dashboard link, 3 chest and 2 back sets show as "5 sets in total", Chest 3, Back 2, Core 0, most-trained first |
| `MuscleGroupStatsControllerTest` (10 cases) | Backend | All groups listed with zeros; each set counted once under its exercise's primary group (also within one session across groups); active sessions excluded; 7/30/all window by end time; custom exercises counted; other users never leak; a deleted workout stops counting; invalid window gives 400; no token gives 401 |

### R12. On a phone, part of the navigation is unreachable

**Impact:** medium. The PRD requires the product to be fully usable on a phone-sized screen; the old top bar overflowed there.

| Test | Level | Covers |
| --- | --- | --- |
| `e2e/mobile-menu.spec.ts` | E2E | At 375 px: only the menu button shows; opening it reveals every link, the logout button and the panel stays inside the screen; picking a link navigates and closes it; Escape closes it |
| `e2e/mobile-layout.spec.ts` | E2E | At 390 px the Edit/Delete buttons of an exercise row sit under the name for short and long names alike |
| The desktop navigation steps in the other e2e specs | E2E | The desktop top bar is unchanged (links stay directly clickable at 1280 px) |

## Not covered by automated tests (known gaps)

- **Substitution suggestions in the browser.** Covered at API level (`ExerciseControllerTest`, `CustomExerciseVisibilityTest`), not through the UI.
- **Guided navigation and rest timer** (skip/return, countdown): frontend behaviour with no automated test.
- **Mobile layout beyond the navigation.** The menu is tested at phone width; the rest of the phone layout (logging forms, charts) is checked by hand.
- **Load/performance.** The "log a set feels immediate" guardrail is not measured.

## Manual release checklist (before a demo or review)

1. Merge the PR that sets `min_machines_running = 1` and run `fly deploy`, so the 16 s Spring Boot start cannot cause a 502 after idle.
2. Open the app once: Supabase's free tier pauses a project after 7 days without traffic.
3. `GET https://gym-track-mateusz.fly.dev/api/health` returns 200.
4. Register a new account on the live frontend, log a set, end the workout, see it in History.
5. Check the CI badge on `main` is green.
