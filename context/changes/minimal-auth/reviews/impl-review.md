<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Minimal Auth: Register, Log In, Log Out — Implementation Plan

- **Plan**: context/changes/minimal-auth/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-22
- **Verdict**: REJECTED
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — JWT signing secret has no fail-fast guard against the public default

- **Severity**: CRITICAL
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/auth/JwtService.java:30
- **Detail**: `@Value("${JWT_SECRET:dev-only-insecure-default-change-me}")` falls back silently to a hardcoded, publicly-known string with no startup check. If `JWT_SECRET` is ever unset in production (e.g. a missed `fly secrets set`), the app boots normally and signs tokens with a key anyone can read from the source — full token forgery for any user ID, with no error or log signal at deploy time.
- **Fix A ⭐ Recommended**: Fail fast whenever the resolved secret equals the literal default, regardless of profile — add a check in `JwtService`'s constructor (or a `@PostConstruct`) that throws `IllegalStateException` if `secret.equals("dev-only-insecure-default-change-me")`, and require local/dev runs to pass `JWT_SECRET` explicitly (e.g. via `application-dev.properties` or an env file).
  - Strength: Can't silently ship — works the same in every environment, no profile-detection logic to get wrong.
  - Tradeoff: Every local dev run now needs an explicit `JWT_SECRET` set (one-time setup cost); breaks `./mvnw spring-boot:run` out of the box unless a dev value is provided via `application.properties`/`.env`.
  - Confidence: HIGH — this is the standard "secret must not have a safe default" pattern and matches the project's existing `${ENV:default}` convention being used correctly everywhere else except this one security-critical case.
  - Blind spot: Haven't checked whether CI or the Testcontainers-backed tests rely on the current default being usable without any `JWT_SECRET` — this fix would need a test-only override (e.g. `application-test.properties` with its own fixed secret) to avoid breaking the test suite.
- **Fix B**: Only fail fast when Spring's active profile is not `dev`/`test` (keep the convenient default for local/dev, guard only prod-like environments).
  - Strength: Zero friction for local development; only prod-equivalent environments are protected.
  - Tradeoff: Requires the project to actually adopt and consistently set Spring profiles, which it doesn't appear to do today (`application.properties` has no profile split) — adds new infrastructure just for this check.
  - Confidence: MEDIUM — depends on introducing a profile convention this project doesn't currently have.
  - Blind spot: Haven't verified how `fly.toml`/deploy sets `SPRING_PROFILES_ACTIVE`, if at all.
- **Decision**: FIXED (Fix A) — added a fail-fast check in `JwtService`'s constructor; added `@TestPropertySource(properties = "JWT_SECRET=...")` to the three `@SpringBootTest` classes so they keep passing without relying on the public default.

### F2 — Password has no upper length bound before BCrypt hashing

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/user/RegisterRequest.java:13; src/main/java/com/example/gymtrack/user/LoginRequest.java
- **Detail**: `@Size(min = 8)` has no `max`. BCrypt hashes whatever is submitted, so an attacker can repeatedly POST multi-MB passwords to `/api/auth/register` or `/login`, paying no cost themselves while the server pays BCrypt's cost factor over an attacker-chosen-size input — a cheap CPU-exhaustion vector on the auth endpoints.
- **Fix**: Add `@Size(min = 8, max = 72)` to both `RegisterRequest.password` and `LoginRequest.password` (72 is BCrypt's own effective input limit, so this costs nothing functionally).
- **Decision**: FIXED — added `max = 72` to `RegisterRequest.password` (kept `min = 8`) and `@Size(max = 72)` to `LoginRequest.password` (no `min`, since login doesn't gate on password strength).

### F3 — `.anyRequest().permitAll()` is a silent trap for future routes

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/config/SecurityConfig.java:49
- **Detail**: After `.requestMatchers("/api/**").authenticated()`, the chain ends with `.anyRequest().permitAll()`. Harmless today (no non-`/api` routes exist), but any future controller accidentally mapped outside `/api/**` — a forgotten `/health` alias, an actuator endpoint, a static handler — is unauthenticated by default with no warning at the point it's added.
- **Fix**: Change `.anyRequest().permitAll()` to `.anyRequest().authenticated()`, and add explicit `permitAll()` matchers for anything meant to be public (mirroring the existing health/register/login matchers above it).
- **Decision**: FIXED — changed to `.anyRequest().authenticated()`.

### F4 — Post-plan topbar commit relocated Dashboard's email/logout UI without a plan update

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/pages/DashboardPage.tsx; frontend/src/components/Topbar.tsx (added in commit b829df1, PR #15, after this plan's phases were marked complete)
- **Detail**: Plan Phase 3 item 6 says DashboardPage "show[s] the logged-in user's email and a logout button." A separate follow-up commit (not part of this plan) moved that UI into a new shared `Topbar` rendered by `RequireAuth` on every protected route instead. End-user behavior is preserved and the hydration-race contract in `RequireAuth.tsx` is untouched and correct, but the plan's per-file contract for `DashboardPage.tsx` is no longer literally true, and the plan was never updated to reflect it.
- **Fix**: Add a short addendum note to `plan.md`'s Phase 3 section recording that the email/logout UI was relocated to a shared `Topbar` component in a follow-up commit, so the plan stays an accurate record.
- **Decision**: FIXED — addendum added to `plan.md`'s Phase 3 section.

### F5 — `UserController.me()` returns an untyped `Map` while `AuthController` uses a typed response record

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/main/java/com/example/gymtrack/user/UserController.java:14
- **Detail**: `AuthController` consistently returns `AuthResponse`, a typed record, for register/login. `UserController.me()` instead returns `Map.of("id", ..., "email", ...)` — the one ad-hoc response shape among otherwise-typed controllers in the same package.
- **Fix**: Introduce a small `UserResponse(UUID id, String email)` record and return that from `me()` instead of `Map.of(...)`.
- **Decision**: FIXED — added `UserResponse` record; `UserController.me()` now returns it.

### F6 — Inconsistent enumeration-hardening policy between register and login

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/main/java/com/example/gymtrack/user/AuthController.java (register path throws `EmailAlreadyExistsException` → 409); src/main/java/com/example/gymtrack/user/InvalidCredentialsException.java (login path, deliberately generic 401)
- **Detail**: `login` intentionally returns one generic 401 for both "no such user" and "wrong password" to avoid enumeration (matches the plan's explicit contract). `register`'s distinct 409 on duplicate email discloses account existence by design — common industry practice for registration flows, but it means the two endpoints apply different enumeration-hardening policies within the same controller, which is worth a deliberate note rather than an implicit inconsistency.
- **Fix**: No code change recommended — this is an accepted tradeoff for registration UX. Leaving as an observation for conscious acknowledgment.
- **Decision**: ACCEPTED — user confirmed no code change; duplicate-email 409 on register is an intentional, accepted tradeoff.

## Automated Verification (re-run during this review)

- `./mvnw compile` — PASS
- `./mvnw test -Dtest=AuthControllerRegisterTest,AuthControllerLoginTest,UserControllerMeTest,JwtServiceTest` — PASS (13/13, Testcontainers-backed)
- `npm run build` (frontend/) — PASS
- `npm run lint` (frontend/) — PASS, exit 0 (2 pre-existing oxlint warnings in AuthContext.tsx, non-blocking, inherent to the intentional hydration pattern — not treated as findings)

## Manual Verification

Not re-executed in this review (requires a running app + browser); all manual steps were checked off in `plan.md`'s Progress section for Phases 1–3 with commit SHAs attached, and no evidence in the diff contradicts them.
