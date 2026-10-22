# Exercise Catalog Seed Implementation Plan

## Overview

Introduce Flyway as the project's migration tool for local development and tests, then ship a
seeded, read-only exercise catalog (~40 English exercises). Each exercise carries one primary
muscle group and zero or more secondary groups. The catalog is served to authenticated users by
`GET /api/exercises`, with an optional `?muscleGroup=` filter. Flyway must **not** run against
the deployed Supabase database: `fly.toml` turns it off and keeps the current `ddl-auto=update`
behaviour there. This is roadmap Foundation F-02 (FR-002, Access Control).

## Current State Analysis

- One entity exists: `User` (`src/main/java/com/example/gymtrack/user/User.java`) — UUID id via
  `GenerationType.UUID`, `@Table(name = "users")`, `@CreationTimestamp`. Packages are
  feature-based (`user/`, `auth/`, `config/`).
- Schema is derived by Hibernate: `spring.jpa.hibernate.ddl-auto=update`
  (`src/main/resources/application.properties:8`). No Flyway/Liquibase, no `data.sql`.
  Local developer databases already hold a Hibernate-created `users` table. The deployed database
  is Supabase (`context/foundation/infrastructure.md`) and currently has no tables.
- DB connection comes from `DB_*` env vars; `fly.toml` (app `gym-track-mateusz`) documents them as
  secrets and has no `[env]` block yet.
- `SecurityConfig` (`config/SecurityConfig.java`) already requires authentication for everything
  under `/api/**` (only `/api/health` and `POST /api/auth/*` are public), so a new
  `GET /api/exercises` is protected without a config change.
- Tests are `@SpringBootTest` + `@AutoConfigureMockMvc` + Testcontainers Postgres
  (`postgres:16-alpine`) with a `JWT_SECRET` `@TestPropertySource`
  (`src/test/java/com/example/gymtrack/user/UserControllerMeTest.java`).
- Spring Boot is 4.1.1 (`pom.xml`), which splits auto-configuration into per-technology
  starters — Flyway needs the dedicated starter plus the Postgres database module.

## Desired End State

Locally and in tests, on a fresh database and on an existing one with `users` already present, the
app starts, Flyway brings the schema to the latest version, and the exercises table contains the
full seed. An authenticated `GET /api/exercises` returns every exercise with `id`, `slug`, `name`,
`primaryMuscleGroup`, `secondaryMuscleGroups`; `?muscleGroup=CHEST` returns only exercises whose
**primary** group is chest. Unauthenticated calls get 401. Locally Hibernate only validates the
schema. The deployed app (Supabase) is configured so that Flyway never runs and behaviour is
unchanged from today.

### Key Discoveries:

- `SecurityConfig.java` — `/api/**` is already `authenticated()`; no new rule needed.
- `application.properties:8` — `ddl-auto=update` must become `validate` for local/tests once Flyway owns the schema, and be overridden back to `update` for production.
- `fly.toml` has no `[env]` block; non-secret overrides belong there so the production guard is versioned with the code.
- The existing local `users` table was created by Hibernate, so Flyway must baseline rather than re-create it.

## What We're NOT Doing

- No Flyway run against Supabase and no deploy in this change. Production keeps `ddl-auto=update`, so the deployed app will not have the seeded catalog until Flyway is deliberately enabled there (a later decision).
- No custom/user-owned exercises (S-05). The table has no owner column; S-05 adds one.
- No write endpoints for the catalog — it is read-only seed data (PRD Access Control).
- No `GET /api/exercises/{id}`, pagination, or search — nothing consumes them yet.
- No frontend work.
- No equipment or movement-pattern fields (PRD's FR-012 counter-argument acknowledges the limitation).
- No weighting rules for secondary groups. Substitution (S-04) and the `?muscleGroup=` filter use the primary group only; how secondary groups feed volume balance (S-10) is that slice's open decision.
- No change to auth behaviour or the `users` schema itself.

## Implementation Approach

Three phases, ordered so the risky infrastructure switch is isolated: (1) adopt Flyway with a
baseline reproducing today's `users` schema, guard production, and prove existing tests still pass;
(2) add the catalog schema and seed as a versioned migration plus the JPA mapping; (3) expose and
test the read API. The muscle-group list is a Java enum persisted as strings; the seed SQL uses the
same literal names, and a test guards that they stay in sync.

## Phase 1: Adopt Flyway locally and guard production

### Overview

Hand schema ownership to Flyway for local and test databases without disturbing the existing
`users` table or auth tests, and make sure the deployed app never runs it.

### Changes Required:

#### 1. Dependencies

**File**: `pom.xml`

**Intent**: Add Flyway so Spring Boot runs migrations at startup when enabled.

**Contract**: `spring-boot-starter-flyway` and `org.flywaydb:flyway-database-postgresql`
(version managed by the Boot parent). Confirm the exact starter artifact name against the
Boot 4.1.1 BOM when implementing.

#### 2. Default configuration

**File**: `src/main/resources/application.properties`

**Intent**: Make Flyway the default schema owner (local, tests) and let it adopt an already-populated local database.

**Contract**: `spring.jpa.hibernate.ddl-auto=validate`; `spring.flyway.enabled=true`;
`spring.flyway.baseline-on-migrate=true`; `spring.flyway.baseline-version=1`. Semantics: on an
empty schema Flyway runs V1 then later versions; on a non-empty schema with no history table
(existing local DBs) it baselines at 1 — treating V1 as already applied — and runs only newer migrations.

#### 3. Production guard

**File**: `fly.toml`

**Intent**: Keep the deployed app on its current behaviour so Flyway never touches Supabase.

**Contract**: add an `[env]` block with `SPRING_FLYWAY_ENABLED = "false"` and
`SPRING_JPA_HIBERNATE_DDL_AUTO = "update"` (Spring relaxed binding overrides the properties above),
and update the header comment to say why. Editing the file does not deploy anything.

#### 4. Baseline migration

**File**: `src/main/resources/db/migration/V1__create_users.sql`

**Intent**: Reproduce, as plain SQL, the `users` table Hibernate currently generates from `User`.

**Contract**: table `users` — `id uuid` primary key; `email varchar(255) not null` unique;
`password_hash varchar(255) not null`; `created_at timestamp(6) with time zone`. Must pass
Hibernate's `validate` against the `User` entity; adjust column types if validation reports a mismatch.

#### 5. Addendum (added during implementation, commit 75c2c58): local profile

**File**: `src/main/resources/application-local.properties`

**Intent**: Let developers run the app locally with a dev-only `JWT_SECRET` while `JwtService` still refuses to start in production without a real one.

**Contract**: Spring profile `local` (`./mvnw spring-boot:run -Dspring-boot.run.profiles=local`) sets `JWT_SECRET` to a public dev-only key; production never activates it.

#### 6. Addendum (added during implementation, commit 75c2c58): ApplicationTests secret

**File**: `src/test/java/com/example/gymtrack/ApplicationTests.java`

**Intent**: `contextLoads` already failed on the baseline because `JWT_SECRET` was unset; criterion 1.2 cannot pass without fixing it.

**Contract**: add the same `@TestPropertySource(properties = "JWT_SECRET=...")` used by the other integration tests.

### Success Criteria:

#### Automated Verification:

- Existing backend suite passes on a fresh Testcontainers DB (V1 creates `users`, `validate` accepts it): `./mvnw test`
- Application context starts with the new defaults: `./mvnw test -Dtest=ApplicationTests`
- `fly.toml` contains both overrides: `grep -E "SPRING_FLYWAY_ENABLED|SPRING_JPA_HIBERNATE_DDL_AUTO" fly.toml`

#### Manual Verification:

- Starting the app (`./mvnw spring-boot:run`) against the **existing local Podman** Postgres (already holding `users`) baselines cleanly: `flyway_schema_history` shows a baseline row at version 1 and registration/login still work.
- Starting against a freshly created empty local database also succeeds.
- Starting locally with `SPRING_FLYWAY_ENABLED=false SPRING_JPA_HIBERNATE_DDL_AUTO=update` creates no `flyway_schema_history` table (simulates the production configuration).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Exercise catalog schema and seed

### Overview

Create the catalog tables, seed them, and map them in JPA.

### Changes Required:

#### 1. Catalog migration + seed

**File**: `src/main/resources/db/migration/V2__create_exercises_and_seed.sql`

**Intent**: Create the catalog tables and insert the ~40 seed exercises in the same versioned migration, so every Flyway-managed environment gets identical data.

**Contract**:
- `exercises(id uuid primary key default gen_random_uuid(), slug varchar(255) not null unique, name varchar(255) not null, primary_muscle_group varchar(32) not null)`.
- `exercise_secondary_muscle_groups(exercise_id uuid not null references exercises(id) on delete cascade, muscle_group varchar(32) not null, primary key (exercise_id, muscle_group))`.
- Seed: 10 primary groups × 4 exercises, English names, kebab-case `slug` (the stable natural key later slices can rely on). Secondary groups filled for compound lifts (e.g. Deadlift: primary BACK, secondary HAMSTRINGS, GLUTES). Suggested set — refine tagging while writing, since it feeds S-04 and S-10:
  - CHEST: Barbell Bench Press, Incline Dumbbell Press, Chest Fly, Push-Up
  - BACK: Deadlift, Pull-Up, Barbell Row, Lat Pulldown
  - SHOULDERS: Overhead Press, Lateral Raise, Face Pull, Arnold Press
  - BICEPS: Barbell Curl, Dumbbell Curl, Hammer Curl, Preacher Curl
  - TRICEPS: Triceps Pushdown, Skull Crusher, Close-Grip Bench Press, Overhead Triceps Extension
  - QUADS: Back Squat, Front Squat, Leg Press, Leg Extension
  - HAMSTRINGS: Romanian Deadlift, Lying Leg Curl, Good Morning, Seated Leg Curl
  - GLUTES: Hip Thrust, Bulgarian Split Squat, Walking Lunge, Glute Bridge
  - CALVES: Standing Calf Raise, Seated Calf Raise, Donkey Calf Raise, Leg Press Calf Raise
  - CORE: Plank, Hanging Leg Raise, Cable Crunch, Ab Wheel Rollout

#### 2. Muscle group enum

**File**: `src/main/java/com/example/gymtrack/exercise/MuscleGroup.java`

**Intent**: The closed list of muscle groups used by the catalog and, later, custom exercises and volume balance.

**Contract**: enum `MuscleGroup { CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS, HAMSTRINGS, GLUTES, CALVES, CORE }`; names are exactly the strings stored in the DB.

#### 3. Entity and repository

**Files**: `src/main/java/com/example/gymtrack/exercise/Exercise.java`, `ExerciseRepository.java`

**Intent**: Read-only JPA mapping of the catalog, following the `User` entity conventions (UUID id, protected no-arg constructor, getters only).

**Contract**: `Exercise` maps `exercises` — `UUID id`, `String slug`, `String name`, `@Enumerated(STRING) MuscleGroup primaryMuscleGroup`, and `@ElementCollection` `Set<MuscleGroup> secondaryMuscleGroups` on `exercise_secondary_muscle_groups` (eager or fetched in the repository query so no lazy loading is needed with `open-in-view=false`). `ExerciseRepository extends JpaRepository<Exercise, UUID>` with a list-by-primary-group query and ordering by name.

### Success Criteria:

#### Automated Verification:

- Migrations V1+V2 apply on a fresh Testcontainers DB and `validate` accepts the entities: `./mvnw test`
- Seed integrity test passes (see Testing Strategy): `./mvnw test -Dtest=ExerciseSeedTest`

#### Manual Verification:

- Against the existing local Podman Postgres, startup applies V2 on top of the baseline and `select count(*) from exercises` returns 40.
- Spot-check the secondary-group tagging of compound lifts reads sensibly.

**Implementation Note**: Pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Catalog read API and tests

### Overview

Expose the catalog to authenticated users and cover it with integration tests.

### Changes Required:

#### 1. Response DTO

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseResponse.java`

**Intent**: Stable API shape, decoupled from the entity (mirrors `UserResponse`).

**Contract**: `record ExerciseResponse(UUID id, String slug, String name, MuscleGroup primaryMuscleGroup, Set<MuscleGroup> secondaryMuscleGroups)`.

#### 2. Controller

**File**: `src/main/java/com/example/gymtrack/exercise/ExerciseController.java`

**Intent**: Read-only list endpoint with an optional primary-group filter.

**Contract**: `GET /api/exercises[?muscleGroup=<MuscleGroup>]` → `200` with a JSON array ordered by name. The filter matches the **primary** muscle group only. An unknown `muscleGroup` value returns `400` (Spring's enum-conversion failure; confirm it does not surface as 500). Requires authentication via the existing `/api/**` rule.

#### 3. Tests

**Files**: `src/test/java/com/example/gymtrack/exercise/ExerciseControllerTest.java`, `ExerciseSeedTest.java`

**Intent**: Prove the endpoint's auth, filtering and error behaviour and guard the seed's data quality.

**Contract**: Same harness as `UserControllerMeTest` (Testcontainers `postgres:16-alpine`, `JWT_SECRET` property, token from `JwtService`). See Testing Strategy for cases.

### Success Criteria:

#### Automated Verification:

- Full backend suite passes: `./mvnw test`
- Build succeeds: `./mvnw package`

#### Manual Verification:

- With the app running locally, register/login, then `GET /api/exercises` with the bearer token returns the 40 exercises; `?muscleGroup=CHEST` returns only the 4 chest exercises; no token returns 401.

**Implementation Note**: Pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- None beyond integration tests; no standalone logic.

### Integration Tests:

- `ExerciseControllerTest`: no token → 401; valid token → 200 and 40 exercises with all fields populated; `?muscleGroup=CHEST` → only exercises whose primary group is CHEST; `?muscleGroup=NOPE` → 400; an exercise with secondary groups (e.g. `deadlift`) returns them.
- `ExerciseSeedTest`: slugs are unique; every `MuscleGroup` value has at least 3 primary exercises (so S-04 always has alternatives); no exercise lists its own primary group among its secondary groups; every stored group string maps to a `MuscleGroup` value.
- Phase 1 relies on the existing suite as the regression check for the Flyway switch.

### Manual Testing Steps:

1. Run the app against the existing local Podman DB; confirm the baseline row and the 40 seeded rows.
2. Call the endpoint with and without a token and with the filter.

## Performance Considerations

~40 rows, unpaginated, read-only — negligible. Avoid N+1 on secondary groups (eager collection or a fetch join).

## Migration Notes

- Local Podman Postgres only: nothing is deployed or run against Supabase in this change.
- Production (Fly.io → Supabase) stays on `ddl-auto=update` with Flyway disabled via `fly.toml` `[env]`. Consequence: if this is deployed as is, Hibernate will create empty `exercises` tables there and `GET /api/exercises` returns `[]` until Flyway is deliberately enabled. Because Supabase has no tables yet, enabling it later needs no baselining (V1 will simply run) — flip the two `fly.toml` values then, after snapshotting.
- Future catalog changes ship as new versioned migrations (V3+), never edits to V2.

## References

- Roadmap item: `context/foundation/roadmap.md` (F-02)
- PRD: `context/foundation/prd.md` (FR-002, FR-012, FR-016, Access Control)
- Infrastructure: `context/foundation/infrastructure.md` (Fly.io + Supabase)
- Entity/test conventions: `src/main/java/com/example/gymtrack/user/User.java`, `src/test/java/com/example/gymtrack/user/UserControllerMeTest.java`
- Prior change: `context/archive/2026-10-21-minimal-auth/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Adopt Flyway locally and guard production

#### Automated

- [x] 1.1 Existing backend suite passes on a fresh Testcontainers DB (V1 creates `users`, `validate` accepts it): `./mvnw test` — 75c2c58
- [x] 1.2 Application context starts with the new defaults: `./mvnw test -Dtest=ApplicationTests` — 75c2c58
- [x] 1.3 `fly.toml` contains both overrides: `grep -E "SPRING_FLYWAY_ENABLED|SPRING_JPA_HIBERNATE_DDL_AUTO" fly.toml` — 75c2c58

#### Manual

- [x] 1.4 Starting the app against the existing local Podman Postgres baselines cleanly (baseline row at version 1; registration/login still work) — 75c2c58
- [x] 1.5 Starting against a freshly created empty local database also succeeds — 75c2c58
- [x] 1.6 Starting locally with the production overrides creates no `flyway_schema_history` table — 75c2c58

### Phase 2: Exercise catalog schema and seed

#### Automated

- [x] 2.1 Migrations V1+V2 apply on a fresh Testcontainers DB and `validate` accepts the entities: `./mvnw test` — 90ba399
- [x] 2.2 Seed integrity test passes: `./mvnw test -Dtest=ExerciseSeedTest` — 90ba399

#### Manual

- [x] 2.3 Against the existing local Podman Postgres, startup applies V2 on top of the baseline and `select count(*) from exercises` returns 40 — 90ba399
- [x] 2.4 Spot-check the secondary-group tagging of compound lifts reads sensibly — 90ba399

### Phase 3: Catalog read API and tests

#### Automated

- [x] 3.1 Full backend suite passes: `./mvnw test` — 647d10c
- [x] 3.2 Build succeeds: `./mvnw package` — 647d10c

#### Manual

- [x] 3.3 With the app running locally, authenticated `GET /api/exercises` returns 40 exercises; `?muscleGroup=CHEST` returns only the 4 chest exercises; no token returns 401 — 647d10c
