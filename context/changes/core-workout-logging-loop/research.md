---
date: 2026-10-22T18:23:47+02:00
researcher: Mateusz
git_commit: 221d8284220d5ce7c7ac1c7df25ebc113a81c3a5
branch: main
repository: 10xDevs
topic: "core-workout-logging-loop (S-01): what exists, what must be built, which contracts it touches"
tags: [research, codebase, workout, session, sets, progression-chart, auth, exercise-catalog]
status: complete
last_updated: 2026-10-22
last_updated_by: Mateusz
---

# Research: core-workout-logging-loop (S-01)

**Date**: 2026-10-22T18:23:47+02:00
**Researcher**: Mateusz
**Git Commit**: 221d8284220d5ce7c7ac1c7df25ebc113a81c3a5 (working tree also has unrelated `.idea/*` edits and this untracked change folder)
**Branch**: main
**Repository**: 10xDevs

## Research Question

S-01: a logged-in user starts a workout session, selects a seeded exercise, logs a set (reps + weight), ends the session, and sees the set on that exercise's progression chart (PRD: US-01, FR-004, FR-005, FR-006, FR-010). What does the codebase already provide, what is absent, and which existing contracts must the slice respect?

## Summary

Scope: the inspected backend (`src/main/java/com/example/gymtrack/**`, `src/main/resources/**`) and frontend (`frontend/src/**`) at the commit above. Research was done locally by the parent agent (about 30 files, small codebase); no sub-agents were used.

- **Nothing S-01-specific exists yet.** The backend has no entity, repository or controller for sessions or sets: the only domain packages are `user`, `exercise` and `auth` (file list in `git ls-files src`). The only Flyway migrations are V1 (users), V2 (exercises + seed) and V3 (a seed correction) (`src/main/resources/db/migration/`). The next migration number is V4.
- **Both prerequisites are in place and usable.** Authenticated identity is available to controllers as `@AuthenticationPrincipal CurrentUser` (`UserController.java:12`, `CurrentUser.java:5`). The catalog is served by `GET /api/exercises` (`ExerciseController.java:17`) with `Exercise.id` as a UUID.
- **Every `/api/**` route except health/register/login already requires a bearer token**, so new endpoints are authenticated by default (`SecurityConfig.java:44-49`). Per-user data isolation is **not** automatic: nothing in the inspected code filters by user, because no user-owned domain data exists yet. The slice must scope every query by `CurrentUser.id()` itself (PRD guardrail: one user's data is never visible to another).
- **The frontend has no product UI.** `DashboardPage` is an explicit placeholder (`DashboardPage.tsx:9`), there is one authenticated route (`App.tsx:15-22`), and `package.json` has no chart library (dependencies: react, react-dom, react-router only). `authFetch` exists for protected calls but throws on any non-2xx and returns the raw `Response` (`client.ts:79-90`).
- **Main design constraints from the roadmap/PRD:** sets are the source of truth and the chart is a view on top (roadmap S-01 Risk, `roadmap.md:115`; PRD FR-010 resolution, `prd.md:117-122`); the first-ever set must render a valid single-point chart (`prd.md:67-68`); logging must persist immediately with no separate save step (`prd.md:65`).

## Detailed Findings

### Identity (F-01) - what S-01 can rely on

- `JwtAuthenticationFilter` rebuilds the principal from token claims without a DB lookup (`JwtAuthenticationFilter.java` class comment, lines 16-19); the principal type is `CurrentUser(UUID id, String email)` (`CurrentUser.java:5`).
- Controllers read it with `@AuthenticationPrincipal CurrentUser` (`UserController.java:11-14`). This is the one existing example of the pattern.
- Consequence (inference from the filter comment): a JWT for a user whose row was later deleted still authenticates. A foreign key from sessions to `users(id)` would make such a request fail at insert time rather than at authentication time. No user-deletion feature exists in the inspected code.
- Unauthenticated requests to protected `/api/**` routes return 401 via an explicit entry point (`SecurityConfig.java:54-55`). Existing tests assert this per endpoint (`ExerciseControllerTest.java`, test `listWithoutTokenReturnsUnauthorized`).

### Catalog (F-02) - what sets reference

- `exercises.id` is `uuid primary key default gen_random_uuid()`; `slug` is unique (`V2__create_exercises_and_seed.sql:1-6`). Catalog rows are read-only seed data; the `Exercise` entity has getters only and no `@GeneratedValue` (`Exercise.java:21-22, 43-61`).
- The list endpoint returns `ExerciseResponse(id, slug, name, primaryMuscleGroup, secondaryMuscleGroups)` ordered by name, optionally filtered by `?muscleGroup=` (`ExerciseController.java:17-24`, `ExerciseResponse.java:10-11`). The frontend can therefore drive an exercise picker from this endpoint as-is.
- Production caveat: `fly.toml` disables Flyway and sets `ddl-auto=update` (stated in `CLAUDE.md` Architecture section), and the F-02 plan recorded that the deployed DB will not have the seeded catalog until Flyway is deliberately enabled (`context/archive/2026-10-22-exercise-catalog-seed/plan.md:51`). Any S-01 migration (V4+) likewise only applies where Flyway runs (local, tests). Under production `update`, Hibernate would create tables from entities with no V4 constraints. Confirmed in `fly.toml:16-17` (`SPRING_FLYWAY_ENABLED = "false"`, `SPRING_JPA_HIBERNATE_DDL_AUTO = "update"`).

### Persistence conventions to follow

- Entities: `@Entity`/`@Table`, UUID id, protected no-arg constructor, getters only (`User.java:13-54`, `Exercise.java:17-63`). `User` uses `@GeneratedValue(strategy = GenerationType.UUID)` and `@CreationTimestamp Instant createdAt` (`User.java:17-28`); `V1` declares `created_at timestamp(6) with time zone` (`V1__create_users.sql:5`).
- Schema is owned by Flyway; Hibernate only validates (`application.properties:7`), so every new entity needs a matching `V4__...sql` or startup validation fails in local/test runs. `spring.jpa.open-in-view=false` (`application.properties:8`) means collections needed in responses must be fetched eagerly or in the query (as `Exercise.secondaryMuscleGroups` does with `FetchType.EAGER`, `Exercise.java:34`).
- Packaging is by feature under `com.example.gymtrack` (`user`, `exercise`, `auth`, `config`); records are used for responses (`ExerciseResponse`, `UserResponse`).
- Error handling: the only `@RestControllerAdvice` is `AuthExceptionHandler` in the `user` package, returning `{"error": "<message>"}` for validation (400), conflict (409) and invalid credentials (401) (`AuthExceptionHandler.java:13-31`). It is not scoped to auth controllers by annotation attributes, so as written it applies globally to `MethodArgumentNotValidException`, but there is no handler for "not found" or "session already ended" - S-01 will need to define those statuses. The frontend's `parseErrorMessage` reads exactly the `error` string field (`client.ts:16-26`), so new error bodies should keep that shape.
- CORS allows GET, POST, PUT, DELETE, PATCH from `http://localhost:5173` and the Netlify origin (`WebConfig.java:12-14`); no new CORS work is implied for those methods.

### Tests - conventions to match

- Integration tests use `@SpringBootTest` + `@AutoConfigureMockMvc` + Testcontainers `postgres:16-alpine` with `@ServiceConnection`, a per-test `JWT_SECRET` via `@TestPropertySource`, and create users directly through `UserRepository`/`PasswordEncoder`, minting tokens with `JwtService.generateToken` (`ExerciseControllerTest.java:30-54`). A cross-user isolation test for sessions/sets can reuse this pattern by creating two users.

### Frontend - what exists and what the slice adds

- Routing: `BrowserRouter` with `/login`, `/register`, and `/` gated by `RequireAuth` (`App.tsx:12-23`). `RequireAuth` renders `Topbar` plus children and returns `null` while auth hydration is loading (`RequireAuth.tsx:11-27`).
- API layer: `client.ts` exports typed helpers per call and a generic `authFetch(path, options)` documented for "future slices" (`client.ts:74-90`). Two limitations relevant to S-01: `authFetch` does not set `Content-Type` (callers sending JSON must set it), and a 401 on an expired token surfaces only as a thrown `Error`; there is no global handler that clears the token and redirects. (`AuthContext` clears a bad token only during initial hydration, `AuthContext.tsx:37-42`.)
- Styling is plain CSS files per page/component (`styles/page.css`, `styles/topbar.css`); no UI kit or Tailwind in `package.json`.
- No chart dependency. The choice (a library such as Recharts versus hand-rolled SVG) is open; see Open Questions. Lint is `oxlint` and the build is `tsc -b && vite build` (`package.json` scripts); there is no frontend test runner in `package.json`.

## Code References

- `src/main/java/com/example/gymtrack/auth/CurrentUser.java:5` - principal record (`UUID id`, `String email`) to scope all S-01 queries.
- `src/main/java/com/example/gymtrack/user/UserController.java:11-14` - the existing `@AuthenticationPrincipal` usage pattern.
- `src/main/java/com/example/gymtrack/config/SecurityConfig.java:44-49` - `/api/**` authenticated by default; new endpoints need no security change.
- `src/main/java/com/example/gymtrack/exercise/ExerciseController.java:17-24` - catalog list endpoint feeding the exercise picker.
- `src/main/java/com/example/gymtrack/exercise/Exercise.java:21-22` - catalog UUID id (FK target for sets).
- `src/main/java/com/example/gymtrack/user/User.java:17-28` - entity conventions (UUID generation, `@CreationTimestamp`).
- `src/main/resources/application.properties:7-8` - `ddl-auto=validate`, `open-in-view=false`.
- `src/main/resources/db/migration/V2__create_exercises_and_seed.sql:1-6` - exercises table definition.
- `src/main/java/com/example/gymtrack/user/AuthExceptionHandler.java:13-31` - existing `{"error": ...}` error contract.
- `frontend/src/api/client.ts:74-90` - `authFetch` wrapper for protected calls.
- `frontend/src/pages/DashboardPage.tsx:9` - placeholder to be replaced by the real logging UI.
- `frontend/src/App.tsx:15-22` - single gated route; S-01 adds routes here.
- `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java:30-54` - integration-test template.

## Architecture Insights

- The system is a stateless JWT API plus a decoupled SPA; ownership must be enforced in queries (e.g. look up a session by id *and* user id), not by framework magic.
- Roadmap S-01 Risk and PRD FR-010 together fix one design rule: persist one row per set with exercise reference, reps, weight and timestamp; compute the chart series as a read-side query. S-03 (progression recommendation), S-08 (PR flag) and S-09 (return-after-break) are all listed as depending on S-01 (`roadmap.md:130-141, 192-215`), so per-set granularity and a per-set timestamp (and which session a set belonged to) are the data S-03/S-09 would later need. This is an inference from the S-03 PRD rule text ("last N workouts of that exercise", `prd.md:124`), not something S-01 must implement.
- "Workout" boundaries matter later: FR-011 counts workouts per exercise, so keeping a set -> session link (rather than loose sets) preserves that grouping.
- The PRD says logging must "feel immediate" (guardrail) and acknowledgement within roughly one second (NFR, `prd.md:162-163`): this argues for one small POST per set and returning the updated chart data (or enough to update it) in the response or via an immediate refetch; both are options, neither is decided.

## Historical Context (from prior changes)

- `context/archive/2026-10-21-minimal-auth/plan.md:8-9, 87-88` - F-01 was planned explicitly as the scoped-identity base and states that all workout/plan/exercise domain logic is out of its scope; its placeholder dashboard was meant to be replaced by S-01 (`plan.md:61-62`). Supported: the placeholder is still the current state (`DashboardPage.tsx:9`).
- `context/archive/2026-10-22-exercise-catalog-seed/plan.md:57` - secondary muscle groups carry no weighting rules; substitution (S-04) uses the primary group only. Not relevant to S-01 beyond confirming the catalog response shape.
- `context/archive/2026-10-22-exercise-catalog-seed/plan.md:51` - Flyway not run against Supabase; production lacks the seeded catalog until Flyway is enabled there. Partial relevance: it affects whether S-01's exercise picker and V4 tables exist in production. Whether S-01's own scope includes deployment is not stated in `change.md` (its Notes cover only the functional loop).
- `context/foundation/lessons.md` does not exist; no recurring-rule entries were applied.
- Prior `reviews/impl-review*.md` files from both archived changes were listed but not read in this pass.

## Related Research

None found: no `research.md` exists under `context/changes/**` or `context/archive/**` (archived folders contain `change.md`, `plan-brief.md`, `plan.md`, `reviews/`; checked by directory listing).

## Open Questions

These are decisions or facts not settled by the inspected sources; the first four are product/design choices for `/10x-plan`, not for this research to settle.

1. **Weight unit and numeric type.** The PRD says "reps + weight" with no unit (`prd.md:93`). Whether to store kilograms only, allow decimals (e.g. 2.5), and what validation ranges apply is undecided.
2. **Chart metric.** FR-010 says "weight or volume over time" (`prd.md:117`). Which one is the default for S-01 (or both, via a toggle), and how a multi-set session maps to one x-axis point (per set, per session best, per session total volume), is undecided. The US-01 acceptance criteria require only that a single data point renders (`prd.md:67-68`).
3. **Session lifecycle rules.** Not defined by the PRD: may a user have more than one active session at once; can a set be logged to an ended session; can a user log a set when no session is active (FR-005 says "during an active session", `prd.md:93`); what happens to a session abandoned without "end". FR-006 only requires that a session can be ended.
4. **Edit/delete of a logged set.** The guardrail says a set is never lost or silently overwritten (`prd.md:52`), and the NFR requires confirmation for destructive actions on workouts/plans (`prd.md:164-165`). Whether S-01 includes any set edit/delete (and if so confirmation UI) is not specified; the S-01 Notes list only start, select, log, end, view.
5. **Chart library.** No dependency exists; adding one is a frontend decision (bundle size, phone-sized touch rendering per NFR `prd.md:159-161`). Not researched against external sources in this pass.
6. **Chart update mechanism.** Return refreshed series from the POST-set call versus refetch via a separate GET; not decided (see Architecture Insights).
7. **Production rollout.** Whether this slice must also address the Flyway-disabled production setup (see Catalog caveat) is not stated in `change.md`.
8. **Unread material.** The two archived `reviews/` folders were not read; any review follow-ups there that touch conventions used by S-01 would not be reflected above.
