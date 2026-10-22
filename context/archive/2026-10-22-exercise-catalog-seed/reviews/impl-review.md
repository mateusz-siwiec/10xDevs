<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Exercise Catalog Seed

- **Plan**: context/changes/exercise-catalog-seed/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-22
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated: `./mvnw test` 23 tests green; `./mvnw package` BUILD SUCCESS; `fly.toml` has both overrides plus `force_https = true`. Manual items 1.4-1.6, 2.3, 2.4, 3.3 are checked and confirmed by the user. Phase 1 findings were triaged in impl-review-phase-1.md.

## Findings

### F1 — Secondary groups are serialized in nondeterministic order

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/exercise/ExerciseResponse.java:15
- **Detail**: Hibernate replaces the `EnumSet` default with its own set, so the JSON order of `secondaryMuscleGroups` is not guaranteed. Tests use `containsInAnyOrder`, so they pass, but a future frontend or snapshot test could see flaky ordering.
- **Fix**: In `ExerciseResponse.from`, copy into an `EnumSet`/sorted set before returning.
- **Decision**: FIXED — Fix now (EnumSet copy in ExerciseResponse.from)

### F2 — Questionable secondary tag on Hammer Curl

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/main/resources/db/migration/V2__create_exercises_and_seed.sql (hammer-curl, BACK)
- **Detail**: Hammer curl is tagged with secondary BACK, which is not a meaningful contributor (the real secondary is forearms, which is not in the enum). The tagging feeds S-04 and S-10. Per the plan, V2 must not be edited later, so any correction goes in a V3 migration.
- **Fix**: Drop the row in a V3 migration, or accept. V2 has not been applied to a shared database yet, so editing it is still safe if preferred.
- **Decision**: FIXED — Fix now (V3__drop_hammer_curl_back_secondary.sql)
