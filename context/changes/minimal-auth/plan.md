# Minimal Auth: Register, Log In, Log Out — Implementation Plan

## Overview

Stand up GymTrack's authentication foundation: email+password registration and
login on the Spring Boot backend, issuing a stateless JWT bearer token, plus
the first routing/auth wiring on the React frontend. This is roadmap
Foundation F-01 — every other roadmap slice (workout logging, plans,
recommendations, …) depends on it for a scoped user identity.

## Current State Analysis

The backend is a bare Spring Boot 4.1.1 scaffold: `Application.java`
(entrypoint), `HealthController.java` (`GET /api/health` only), and
`config/WebConfig.java` (CORS for `/api/**`, allowing `http://localhost:5173`
and `https://gym-track-mateusz.netlify.app`). There is no Spring Security, no
JPA entity, no repository anywhere in `src/main/java/com/example/gymtrack`.
`pom.xml` has only `spring-boot-starter-webmvc`, `spring-boot-starter-data-jpa`,
the Postgres driver, devtools, and `spring-boot-starter-webmvc-test` (this
project's Spring Boot 4.1.1 renames some starters from their familiar 3.x
names, e.g. `-webmvc-` instead of `-web-`). Checked directly against the
cached BOM (`~/.m2/repository/org/springframework/boot/spring-boot-dependencies/4.1.1/spring-boot-dependencies-4.1.1.pom`):
`spring-boot-starter-security` and `spring-boot-testcontainers` both keep
their familiar names and are version-managed by this parent (the latter
pulls in `testcontainers-bom` 2.0.5, so `org.testcontainers:postgresql` and
`org.testcontainers:junit-jupiter` need no explicit version either). `jjwt`
is not Spring-managed at all (no Spring BOM ever bundles it) — its version
still needs picking against Maven Central at implementation time.

The frontend (`frontend/`) is the untouched default Vite+React template:
`App.tsx`, no router, no forms, no API client, no auth-related dependency in
`package.json`.

### Key Discoveries:

- `WebConfig.java:12-14` already allows CORS across two *different* origins
  (`localhost:5173` dev, a Netlify domain) — confirms frontend and backend are
  cross-origin by deployment design, which is why this plan uses an
  `Authorization` header bearer token instead of a cookie (cross-site cookies
  need `SameSite=None; Secure` + `allowCredentials`, and are increasingly
  restricted by browsers).
- `WebConfig.java`'s `addCorsMappings` call never calls `.allowedHeaders(...)`,
  so Spring's default (`*`, allow all headers) applies — the `Authorization`
  header requires **no change** to `WebConfig.java`.
- `spring.jpa.hibernate.ddl-auto=update` (`application.properties:7`) means the
  new `User` entity's table is created automatically on next boot — no
  migration tooling exists or is needed for this change (per `CLAUDE.md`).
- `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` already follow an
  `${ENV:default}` pattern in `application.properties` — the new JWT signing
  secret should follow the same convention (`${JWT_SECRET:dev-only-default}`)
  so it's overridable via `fly secrets set` in production without code changes.

## Desired End State

A user can register with email+password, receive a token, call any
`/api/**` endpoint with it, and have the request resolve to their identity
with no database lookup beyond the one at login. A user can log in again
later and get a fresh token. "Logging out" clears the token client-side — no
server-side session or revocation state exists. On the frontend, visiting the
app without a valid token redirects to `/login`; after login, the user lands
on a placeholder protected page (stands in for the real workout UI that
roadmap slice S-01 will build on top of this).

Verify via: `./mvnw test` (backend, Testcontainers-backed), and the manual
curl/browser flows in each phase's Manual Verification.

### Key Discoveries:

- (see Current State Analysis above — all discoveries apply directly to this
  plan's design, not a separate exploration)

## What We're NOT Doing

- **OAuth / passwordless login** — PRD's Access Control lists them as options,
  but email+password is this foundation's only method; adding a provider is a
  separate future change.
- **Password reset / forgot-password flow** — not in the PRD; would require
  new transactional-email infrastructure this foundation doesn't otherwise
  need. A user who forgets their password has no self-service recovery yet.
- **Refresh tokens / token rotation** — a single long-lived token is issued at
  login; there is no refresh endpoint or rotation logic. A leaked token stays
  valid for its full lifetime.
- **Server-side logout / token revocation** — logout is purely a frontend
  action (discard the stored token). No blocklist table, no server call.
- **Roles or an admin/trainer role** — PRD's Access Control is explicit: flat
  role model, every user manages only their own data, no admin role in MVP.
- **Any workout/plan/exercise domain logic** — this change only establishes
  identity; roadmap slice S-01 and later build on top of it.
- **Frontend automated tests** — no frontend test framework exists yet;
  backend integration tests are this change's automated safety net.

## Implementation Approach

Backend: Spring Security in stateless mode (no HTTP session, CSRF disabled —
there's no cookie to forge). A `User` entity (UUID id, unique email, BCrypt
hash) backs `POST /api/auth/register` and `POST /api/auth/login`, both of
which return a signed JWT. A custom filter reads `Authorization: Bearer
<token>` on every request, verifies the signature and expiry, and — since the
token's claims already carry the user's id and email — reconstructs the
authenticated principal **without hitting the database**, then sets it on
`SecurityContext`. `GET /api/users/me` is both the frontend's
token-validation call and the first protected-route proof.

Frontend: `react-router` v7 introduces the app's first routes (`/login`,
`/register`, and a protected root route). An `AuthContext` owns the token
(persisted to `localStorage`) and the hydrated user (fetched via `/me` on
load, so a page refresh doesn't log the user out). A `RequireAuth` wrapper
redirects to `/login` when hydration finishes with no valid user.

## Critical Implementation Details

- **JWT filter ordering**: the custom JWT filter must be registered with
  `.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)`
  in the `SecurityFilterChain` bean. Registering it after (or relying on
  default ordering) means protected routes 401 even with a valid token,
  because Spring Security's anonymous-authentication filter runs first and
  never gets overridden.
- **Frontend auth-hydration race**: `RequireAuth` must not redirect to
  `/login` until `AuthContext`'s initial `/me` hydration call has resolved
  (success, 401, or network error). Evaluating the route guard before
  hydration finishes causes a flash-redirect to `/login` on every page
  refresh, even for a user with a valid token — gate rendering on a
  `loading` flag, not just on `user` being null.

## Phase 1: Backend — user model + registration

### Overview

Add the `User` entity, password hashing, and a working `POST
/api/auth/register` endpoint, verified against a real Postgres instance.

### Changes Required:

#### 1. Dependencies

**File**: `pom.xml`

**Intent**: Add Spring Security (password hashing + the filter chain used in
Phase 2) and a JWT library for token issuance/verification used starting
Phase 2. Add Testcontainers (Postgres module + JUnit Jupiter integration) as
test-scope dependencies for this phase's integration tests.

**Contract**: New dependencies, all version-managed by the parent BOM except
jjwt: `spring-boot-starter-security`, `org.springframework.boot:spring-boot-testcontainers`
(test scope, enables `@ServiceConnection` wiring), `org.testcontainers:postgresql`
and `org.testcontainers:junit-jupiter` (test scope). Plus
`io.jsonwebtoken:jjwt-api` + `jjwt-impl` (runtime) + `jjwt-jackson` (runtime),
pinned to a current stable 0.12.x release — jjwt isn't in any Spring BOM, so
check Maven Central for the latest 0.12.x at implementation time.

#### 2. User entity

**File**: `src/main/java/com/example/gymtrack/user/User.java` (new package)

**Intent**: The row every other roadmap slice's data will be scoped to.

**Contract**: `@Entity` with `id: UUID` (`@GeneratedValue(strategy =
GenerationType.UUID)`), `email: String` (`@Column(unique = true, nullable =
false)`, stored lowercase), `passwordHash: String` (`nullable = false`),
`createdAt: Instant` (`@CreationTimestamp` or set in a constructor). No role
field — flat role model per PRD Access Control.

#### 3. User repository

**File**: `src/main/java/com/example/gymtrack/user/UserRepository.java`

**Intent**: Lookup by email for both registration's uniqueness check and
login's credential check.

**Contract**: `interface UserRepository extends JpaRepository<User, UUID>`
with `Optional<User> findByEmail(String email)`.

#### 4. Registration endpoint

**File**: `src/main/java/com/example/gymtrack/user/AuthController.java` (new)

**Intent**: `POST /api/auth/register` validates the request, hashes the
password, persists the user, and auto-logs-in by returning a token (the JWT
issuance itself lands in Phase 2 — until then, this endpoint can return the
created user's id/email without a token, and Phase 2 wires the token in).

**Contract**: Request DTO `RegisterRequest { @Email email; @Size(min = 8)
password }`. On success: `201` with the created user's id + email. On
duplicate email (case-insensitive): `409` with `{"error": "..."}`. On
validation failure (bad email format, password under 8 chars): `400` with
`{"error": "..."}` via a `@RestControllerAdvice` handling
`MethodArgumentNotValidException` and a custom `EmailAlreadyExistsException`.

#### 5. Password hashing bean

**File**: `src/main/java/com/example/gymtrack/config/SecurityConfig.java`
(new — this class grows in Phase 2 to hold the filter chain too)

**Intent**: Standard BCrypt hashing, reused by both registration (hash) and
login (verify, added in Phase 2).

**Contract**: `@Bean PasswordEncoder passwordEncoder()` returning `new
BCryptPasswordEncoder()`.

### Success Criteria:

#### Automated Verification:

- Backend builds: `./mvnw compile`
- Integration tests pass: `./mvnw test -Dtest=AuthControllerRegisterTest`
  (new test class — register success → 201 with no password/hash in the
  response body; duplicate email → 409; password under 8 chars → 400;
  malformed email → 400)

#### Manual Verification:

- `curl -X POST http://localhost:8080/api/auth/register -H "Content-Type:
  application/json" -d '{"email":"a@b.com","password":"password123"}'`
  returns 201, and a row appears in the `users` table with a bcrypt hash
  (not the plaintext password).
- Repeating the same curl returns 409.

---

## Phase 2: Backend — login + JWT + protected endpoint

### Overview

Issue and verify JWTs: login returns one, a filter validates it on every
request, and `GET /api/users/me` proves the end-to-end contract.

### Changes Required:

#### 1. JWT service

**File**: `src/main/java/com/example/gymtrack/auth/JwtService.java` (new
package `auth`)

**Intent**: Single place that signs and parses tokens, so the filter and the
auth endpoints share one implementation.

**Contract**: `generateToken(UUID userId, String email): String` (HS256,
subject = `userId.toString()`, custom claim `email`, expiry = now + a
configurable duration, default 30 days via
`${jwt.expiration-days:30}`); `parseToken(String token): Optional<JwtClaims>`
(a small record `JwtClaims(UUID userId, String email)`) returning empty on
any signature/expiry/format failure — never throws past this boundary.
Signing key from `${JWT_SECRET:dev-only-insecure-default-change-me}`,
following the existing `${ENV:default}` convention in
`application.properties`.

#### 2. JWT authentication filter

**File**:
`src/main/java/com/example/gymtrack/auth/JwtAuthenticationFilter.java` (new)

**Intent**: Reconstruct the authenticated principal from the token's claims
alone — no database round-trip per request.

**Contract**: `extends OncePerRequestFilter`. Reads `Authorization: Bearer
<token>`; if present and `JwtService.parseToken` succeeds, sets
`SecurityContextHolder`'s context to an authenticated
`UsernamePasswordAuthenticationToken` whose principal is a `CurrentUser(UUID
id, String email)` record and whose authorities are empty (flat role model —
nothing to grant). Missing/invalid header: continue the chain unauthenticated
(Spring Security's own entry point then returns 401 for protected routes).

#### 3. Security filter chain

**File**: `src/main/java/com/example/gymtrack/config/SecurityConfig.java`
(extends Phase 1's file)

**Intent**: Stateless API security — no session, no CSRF token, JWT filter in
front.

**Contract**: `@Bean SecurityFilterChain` with `.sessionManagement(... ->
SessionCreationPolicy.STATELESS)`, `.csrf(AbstractHttpConfigurer::disable)`,
`.authorizeHttpRequests` permitting `GET /api/health`, `POST
/api/auth/register`, `POST /api/auth/login`, requiring authentication for
everything else under `/api/**`, and
`.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)`
— see Critical Implementation Details above for why the ordering matters.

#### 4. Login endpoint + wire registration's token

**File**: `src/main/java/com/example/gymtrack/user/AuthController.java`
(extends Phase 1's file)

**Intent**: `POST /api/auth/login` verifies credentials and issues a token;
`POST /api/auth/register` (from Phase 1) now also returns a token so
registration auto-logs-in.

**Contract**: `LoginRequest { String email; String password }`. Success:
`200` with `{"token": "...", "id": "...", "email": "..."}`. Failure (email
not found, or password mismatch): `401` with a single generic
`{"error": "Invalid email or password"}` — do not distinguish the two
causes in the response (avoids user enumeration).

#### 5. Protected `/me` endpoint

**File**: `src/main/java/com/example/gymtrack/user/UserController.java` (new)

**Intent**: The frontend's token-hydration call, and the first real proof
that protected-route authentication works end to end.

**Contract**: `GET /api/users/me`, requires authentication (enforced by the
filter chain, not a manual check in the method). Returns `{"id": "...",
"email": "..."}` read directly from the resolved `CurrentUser` principal
(`@AuthenticationPrincipal CurrentUser currentUser`) — no database query.

### Success Criteria:

#### Automated Verification:

- Integration tests pass: `./mvnw test -Dtest=AuthControllerLoginTest` (login
  success → 200 with a token; wrong password → 401; nonexistent email → 401,
  same error body as wrong password)
- Integration tests pass: `./mvnw test -Dtest=UserControllerMeTest` (valid
  token → 200 with correct id/email; missing `Authorization` header → 401;
  malformed/invalid-signature token → 401)
- Unit tests pass: `./mvnw test -Dtest=JwtServiceTest` (round-trip
  generate→parse returns the original claims; a token signed with a
  different key fails to parse; an expired token — construct with a
  near-zero expiration — fails to parse)

#### Manual Verification:

- `curl -X POST http://localhost:8080/api/auth/login -d
  '{"email":"a@b.com","password":"password123"}'` returns a token.
- `curl http://localhost:8080/api/users/me -H "Authorization: Bearer
  <token>"` returns the registered user's id/email.
- The same request with no header, or with `Bearer garbage`, returns 401.

---

## Phase 3: Frontend — routing + auth UI

### Overview

Wire the frontend to the backend's auth API: first-ever routing, a login/
register flow, token persistence across refresh, and a placeholder protected
page.

### Changes Required:

#### 1. Dependencies

**File**: `frontend/package.json`

**Intent**: Add the app's first router.

**Contract**: Add `react-router` (v7) to `dependencies`.

#### 2. API client

**File**: `frontend/src/api/client.ts` (new)

**Intent**: One place that knows the backend's base URL and attaches the
stored token — every future slice's API calls reuse `authFetch`.

**Contract**: `register(email, password)`, `login(email, password)` (both
`POST`, return `{token, id, email}`), `getMe(token)` (`GET`, returns `{id,
email}` or throws on non-2xx), and a generic `authFetch(path, options)` that
reads the token from `localStorage` and sets the `Authorization` header.
Base URL from `import.meta.env.VITE_API_BASE_URL` (new env var; default
`http://localhost:8080` for local dev against the backend's default port).

#### 3. Auth context

**File**: `frontend/src/auth/AuthContext.tsx` (new)

**Intent**: Single source of truth for "who is logged in," including the
refresh-survival hydration call.

**Contract**: `AuthProvider` holds `{ user: {id, email} | null, loading:
boolean, login, register, logout }`. On mount: if a token exists in
`localStorage`, call `getMe`; on success set `user`, on failure clear the
stored token and leave `user` null. Always set `loading = false` once this
resolves (success or failure) — see Critical Implementation Details above.
`login`/`register` call the API client, store the returned token in
`localStorage`, and set `user`. `logout` clears `localStorage` and `user` —
no API call (per the agreed client-side-only logout).

#### 4. Protected route guard

**File**: `frontend/src/auth/RequireAuth.tsx` (new)

**Intent**: Gate the placeholder protected page (and every future slice's
routes) behind a valid session.

**Contract**: Reads `{ user, loading }` from `AuthContext`. While `loading`,
render nothing (or a minimal placeholder) — do not redirect. Once resolved:
render `children` if `user` is set, otherwise redirect to `/login`.

#### 5. Login / register pages

**File**: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx` (new)

**Intent**: Minimal controlled forms calling `AuthContext`'s `login`/
`register`, showing the backend's error message inline on failure, and
navigating to `/` on success.

**Contract**: Each is a plain form with email + password inputs (comfortably
tappable touch targets per the PRD's mobile-usability NFR), a submit button,
and an inline error `<p>` bound to the caught error message.

#### 6. Placeholder protected page + router wiring

**File**: `frontend/src/pages/DashboardPage.tsx` (new), `frontend/src/App.tsx`
(rewrite)

**Intent**: Prove the whole loop end-to-end with a stand-in for the real
workout UI that roadmap slice S-01 builds next; show the logged-in user's
email and a logout button.

**Contract**: `App.tsx` wraps the tree in `AuthProvider` + `BrowserRouter`,
defines routes `/login`, `/register`, and `/` (wrapped in `RequireAuth`,
rendering `DashboardPage`).

### Success Criteria:

#### Automated Verification:

- Frontend builds: `npm run build` (in `frontend/`)
- Lint passes: `npm run lint` (in `frontend/`)

#### Manual Verification:

- Registering via the `/register` form logs the user in and lands on the
  dashboard showing their email.
- Logging out returns to `/login`; visiting `/` while logged out redirects to
  `/login`.
- After logging in, a hard page refresh on `/` stays logged in (no flash of
  the login page) — proves the hydration-before-redirect ordering works.
- Logging in on a phone-sized viewport (e.g. browser dev tools at 375px
  width): both inputs and the submit button are comfortably tappable.

---

## Testing Strategy

### Unit Tests:

- `JwtServiceTest` — generate/parse round-trip, wrong-key rejection, expiry
  rejection.

### Integration Tests:

- `AuthControllerRegisterTest`, `AuthControllerLoginTest`,
  `UserControllerMeTest` — all `@SpringBootTest` + `MockMvc`, backed by a
  real Testcontainers Postgres instance (not H2 — catches the real unique-
  email constraint and UUID generation strategy against the actual engine).

### Manual Testing Steps:

1. Full curl flow: register → login → call `/me` with the token → call `/me`
   with no token (401) → call `/me` with a garbage token (401).
2. Full browser flow: register → land on dashboard → refresh page (stays
   logged in) → log out → redirected to `/login` → try visiting `/` directly
   (redirected to `/login`).
3. Mobile-viewport check on the login/register forms per the NFR.

## Performance Considerations

JWT verification is a local HMAC check with no database round-trip (claims
carry id + email), so authenticated requests other than login/register don't
add DB load. BCrypt's default cost factor adds roughly 100ms to
register/login — acceptable against the PRD's ~1-second feedback NFR, which
this endpoint pair is not on the hot path for anyway (it's not the mid-
workout logging action the NFR specifically calls out).

## Migration Notes

None — `spring.jpa.hibernate.ddl-auto=update` creates the new `users` table
automatically on next boot, per this project's existing (migration-tool-free)
convention.

## References

- Roadmap Foundation: `context/foundation/roadmap.md` — F-01 (Change ID:
  `minimal-auth`)
- PRD: `context/foundation/prd.md` — FR-001, Access Control
- GitHub backlog issue: `mateusz-siwiec/10xDevs#2`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — user model + registration

#### Automated

- [x] 1.1 Backend builds: `./mvnw compile` — f377cad
- [x] 1.2 Integration tests pass: `./mvnw test -Dtest=AuthControllerRegisterTest` — f377cad

#### Manual

- [x] 1.3 curl register returns 201 and a bcrypt-hashed row exists — f377cad
- [x] 1.4 Repeating the same curl register returns 409 — f377cad

### Phase 2: Backend — login + JWT + protected endpoint

#### Automated

- [x] 2.1 Integration tests pass: `./mvnw test -Dtest=AuthControllerLoginTest` — e3096b2
- [x] 2.2 Integration tests pass: `./mvnw test -Dtest=UserControllerMeTest` — e3096b2
- [x] 2.3 Unit tests pass: `./mvnw test -Dtest=JwtServiceTest` — e3096b2

#### Manual

- [x] 2.4 curl login returns a token — e3096b2
- [x] 2.5 curl `/me` with the token returns the correct id/email — e3096b2
- [x] 2.6 curl `/me` with no header or a garbage token returns 401 — e3096b2

### Phase 3: Frontend — routing + auth UI

#### Automated

- [x] 3.1 Frontend builds: `npm run build`
- [x] 3.2 Lint passes: `npm run lint`

#### Manual

- [x] 3.3 Register via UI logs in and shows the dashboard with the user's email
- [x] 3.4 Logout returns to `/login`; visiting `/` while logged out redirects to `/login`
- [x] 3.5 Hard refresh on `/` while logged in stays logged in (no login-page flash)
- [x] 3.6 Login/register forms are comfortably tappable at a 375px viewport
