# Minimal Auth: Register, Log In, Log Out — Plan Brief

> Full plan: `context/changes/minimal-auth/plan.md`

## What & Why

Stand up GymTrack's authentication foundation — email+password registration
and login, issuing a stateless JWT, plus the first routing/auth wiring on the
React frontend. This is roadmap Foundation F-01: every other roadmap slice
(workout logging, plans, recommendations) depends on it for a scoped user
identity, and FR-001/Access Control require it directly.

## Starting Point

The backend is a bare Spring Boot scaffold with only a health-check endpoint
— no Spring Security, no entities, no auth code. The frontend is the
untouched default Vite+React template — no router, no forms, no API client.
`WebConfig.java` already allows CORS across two different origins
(`localhost:5173` and a Netlify domain), confirming the frontend and backend
are deployed cross-origin.

## Desired End State

A user can register with email+password, land logged in, and have every
`/api/**` request they make recognized as theirs via a bearer token — no
server-side session, no database lookup beyond the one at login. Logging out
is instant and purely client-side. Refreshing the page while logged in stays
logged in. Everything here is foundation work: the protected page the user
lands on is a placeholder that roadmap slice S-01 replaces with the real
workout-logging UI.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Auth method | Email + password only | Matches the roadmap's own note to keep this scaffold minimal; OAuth/passwordless stay PRD-allowed options for later. |
| Token delivery & storage | JWT in `Authorization` header, stored in `localStorage` | Sidesteps cross-site cookie restrictions entirely, since frontend (Netlify) and backend (Fly.io) are different origins. |
| Token lifetime | Single long-lived token (30 days), no refresh flow | Minimal surface — no rotation/revocation table or refresh endpoint for a personal-use MVP. |
| Logout semantics | Client-side token discard only | Zero extra persistence or endpoint logic; consistent with the single-long-lived-token choice. |
| Password reset | Out of scope, deferred | Not in the PRD; would need new transactional-email infrastructure. |
| Frontend routing | react-router v7 | De facto standard for React SPAs, needed anyway once S-01 adds real screens. |
| Testing approach | Backend integration tests via Testcontainers (real Postgres); no frontend tests yet | Catches real JPA/Postgres constraint behavior that mocks would hide. |
| User ID type | UUID (research decision, not asked) | Non-enumerable ids, fits the "one user's data never visible to another" guardrail. |
| `/me` endpoint data source | Token claims only, no DB query | Claims already carry id + email; avoids a database round-trip on every authenticated request. |

## Scope

**In scope:**
- `User` entity, repository, BCrypt password hashing
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`
- Stateless Spring Security filter chain + JWT issuance/verification
- Frontend routing, `AuthContext`, login/register forms, protected placeholder page, client-side logout

**Out of scope:**
- OAuth / passwordless login
- Password reset / forgot-password flow
- Refresh tokens or token rotation
- Server-side logout / token revocation
- Any role beyond the flat single-user model
- Any workout/plan/exercise domain logic (that's roadmap slice S-01 onward)
- Frontend automated tests

## Architecture / Approach

Backend: a custom `OncePerRequestFilter` reads the `Authorization: Bearer`
header, verifies the JWT's signature/expiry via a `JwtService`, and
reconstructs the authenticated principal directly from the token's claims
(no DB lookup) before Spring Security's own filter chain evaluates
`@AuthenticationPrincipal`-based access. Frontend: `AuthContext` persists the
token to `localStorage` and hydrates the user via `/me` on load, gating
`RequireAuth`'s redirect on a `loading` flag so a page refresh never
flash-redirects a valid session to `/login`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend — user model + registration | `User` entity + `POST /api/auth/register`, Testcontainers-verified | Picking a jjwt version — it's the one new dependency not managed by Spring's BOM |
| 2. Backend — login + JWT + protected endpoint | `POST /api/auth/login`, JWT filter, `GET /api/users/me` | Filter registration ordering — must run before `UsernamePasswordAuthenticationFilter` or protected routes 401 even with a valid token |
| 3. Frontend — routing + auth UI | react-router, `AuthContext`, login/register forms, protected placeholder page | Hydration race — redirecting before the initial `/me` call resolves causes a false flash-redirect to `/login` on every refresh |

**Prerequisites:** None beyond what's already in the repo (Postgres via
`podman-compose`, Docker available for Testcontainers in dev/CI).
**Estimated effort:** 3 phases, each independently verifiable before moving
to the next.

## Open Risks & Assumptions

- Checked directly against the cached Spring Boot 4.1.1 BOM:
  `spring-boot-starter-security` and `spring-boot-testcontainers` both keep
  their familiar artifact ids and are version-managed by the parent (no
  explicit version needed). `jjwt` is never Spring-managed — Phase 1 still
  needs to pick a current stable 0.12.x release against Maven Central.
- A single long-lived token with no revocation means a leaked token is valid
  until it expires (30 days) — accepted tradeoff for a personal-use MVP, not
  a production multi-tenant security posture.

## Success Criteria (Summary)

- A new user can register, is immediately logged in, and sees their email on
  a protected page.
- The same user can log out, get redirected to `/login`, and log back in.
- A page refresh while logged in never bounces the user back to `/login`.
- Every later roadmap slice can rely on `@AuthenticationPrincipal CurrentUser`
  to get "whose data is this" with no additional auth plumbing.
