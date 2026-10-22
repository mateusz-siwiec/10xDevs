<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Exercise Catalog Seed

- **Plan**: context/changes/exercise-catalog-seed/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Production guard depends on a single file; Flyway is on by default

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/resources/application.properties:10-12, fly.toml:15-17
- **Detail**: The defaults are `flyway.enabled=true`, `baseline-on-migrate=true` and `ddl-auto=validate`. The only thing keeping Flyway off Supabase is the `[env]` block in `fly.toml`. Any other process pointed at Supabase without those two variables (for example a local run with `DB_HOST` set to Supabase, or someone removing the `[env]` block) would run Flyway and migrate the database you asked to keep out of it. Nothing automated checks the guard; criterion 1.3 only greps for the strings.
- **Fix**: Document in CLAUDE.md that Flyway is default-on and that `fly.toml` [env] is what disables it in production, with a warning not to point a local run at Supabase.
  - Strength: Zero code change, and puts the rule where future agents and you will read it.
  - Tradeoff: Still relies on discipline, not enforcement.
  - Confidence: HIGH — the exposure only exists when `DB_*` is overridden, and the plan already scopes this change to local only.
  - Blind spot: I have not checked how `DB_*` is set on Fly beyond `fly.toml`'s comment.
- **Decision**: FIXED — Fix now (Flyway/production note added to CLAUDE.md)

### F2 — Unplanned additions: local profile and ApplicationTests fix

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/main/resources/application-local.properties, src/test/java/com/example/gymtrack/ApplicationTests.java:9
- **Detail**: Both files are in the Phase 1 commit but absent from the plan's Changes Required. Both are small, were requested or required (the local profile at your request, the test fix because criterion 1.2 could not pass without it), and are harmless, but the plan no longer matches what shipped.
- **Fix**: Add a short addendum to Phase 1 in plan.md listing both changes.
- **Decision**: FIXED — Fix now (addendum 5-6 added to plan.md Phase 1)

### F3 — CLAUDE.md still describes the old persistence setup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md:44
- **Detail**: It says the project uses `ddl-auto=update` with "no migration tool (e.g. Flyway/Liquibase) is configured yet". That is now false for local and tests, and the run command lacks the `local` profile needed to supply `JWT_SECRET`. Agents read this file first, so it will mislead them.
- **Fix**: Update the Persistence bullet and the "Run the API" command in CLAUDE.md (combine with F1's note).
- **Decision**: FIXED — Fix now (CLAUDE.md persistence bullet and run command updated)
