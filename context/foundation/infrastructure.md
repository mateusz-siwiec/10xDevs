---
project: gym-track
researched_at: 2026-10-13
recommended_platform: fly.io
runner_up: railway
context_type: mvp
tech_stack:
  language: java
  framework: spring-boot
  runtime: jvm21
---

## Recommendation

**Deploy the backend on Fly.io; use Supabase's free-tier managed Postgres as the database instead of self-hosting Postgres on Fly or paying for Fly Managed Postgres (MPG).**

Fly.io is the only researched platform that already has a working, unmodified deployment in this repo (`fly.toml` + the multi-stage Dockerfile) and the strongest GA story for a persistent JVM process (Docker/Java support, CLI, WebSocket/TCP proxying all GA, confirmed by direct research — not training-data assumption). The database decision went through two revisions: Fly's own Managed Postgres starts at $38/mo (dwarfing the backend's own near-zero idle compute cost), so the first fallback was self-hosting Postgres as a plain Fly Machine — but that shifts backups, version upgrades, and failover entirely onto the project with no managed safety net. Supabase's free tier removes that operational burden for $0 (confirmed current limits: 500MB database, 2 free projects per org), at the cost of a new risk unique to it: free projects auto-pause after 7 days with no traffic and must be manually un-paused from the Supabase dashboard. For a low-traffic educational MVP that may sit untouched for stretches, that's a real but survivable tradeoff — tracked in the risk register below. Railway is recorded as runner-up: it has a GA, fully managed Postgres template co-located with compute (no cross-vendor hop, no pause-on-inactivity risk), and is the natural fallback if Supabase's pausing behavior proves too disruptive in practice.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Verdict |
|---|---|---|---|---|---|---|
| Cloudflare | Partial — container rollback unconfirmed in docs | Partial — no native Postgres (needs Supabase/Neon via Hyperdrive) | Pass — llms.txt + markdown, GA | Partial — no published max-duration for Containers | Partial — MCP is a platform strength but on the Workers/JS side, not applicable to Java ops | Technically capable (GA Containers since 2026-04-13) but fights the stated co-location preference and single-region answer removes its main edge advantage |
| Vercel | Pass — CLI is GA | Fail — Java path is Beta Container Runtime, scale-to-zero (5 min idle), no native Postgres (Neon via marketplace) | Partial | Fail — everything backend-relevant (Container Runtime, WebSockets) is Beta | Partial — MCP itself is Beta | Weakest fit for this stack; nothing backend-relevant is GA |
| Netlify | — | **Fail — no JVM runtime exists on any plan, ever** (Lambda-compat path is Node/Go only and is deprecated) | Pass (frontend docs only) | — | Pass (official MCP, frontend ops only) | **Hard-filtered out** — can only ever host the static React/Vite frontend, never the Spring Boot backend |
| **Fly.io** | Pass — `flyctl` GA, deploy/launch/logs all current; rollback is a documented two-step pattern (`fly releases` then `fly deploy --image`), not a single command | Pass for compute (managed Machines, automatic TLS/routing/scaling). Database is **not** co-located: paired with Supabase's free managed Postgres over the network instead of Fly's own $38/mo MPG or a self-hosted Machine | Pass — public markdown docs on GitHub (`superfly/docs`) plus `fly.io/llms.txt` | Pass — `fly deploy` is deterministic; rollback is a known, documented pattern | Partial — official, Fly-built `fly mcp server` exists (apps/certs/logs/machine/orgs/platform/secrets/status/volumes tools), but it has no GA/beta label and explicitly does **not** expose a deploy tool, so it only covers inspection/management, not shipping releases | **Recommended** — best balance once the database moves off Fly entirely (Supabase free tier) |
| Railway | Partial — rollback is dashboard-only, not scripted | Pass — GA Docker auto-detection, one-click GA managed Postgres template, co-located with compute | Pass — `railwayapp/docs` on GitHub, markdown | Partial — deploy is GA/deterministic, but Maven build-timeout limits are undocumented | Pass — official hosted MCP server (`mcp.railway.com`) live today | **Runner-up** — best all-around balance, held back mainly by time-based billing (~$25-35/mo regardless of traffic) and no scripted rollback |
| Render | Partial — thin CLI, no CLI rollback (dashboard/API only) | Pass — Docker/JVM explicitly recommended in official docs; managed Postgres is GA once on a paid plan (free Postgres expires after 30 days) | **Fail — closed-source docs site, no confirmed markdown/GitHub source** | Partial — deploys are deterministic via CLI/API; rollback is Dashboard/API only | **Fail — no official MCP, community wrapper only** | Cheapest realistic floor (~$13-20/mo) but weakest on the two criteria this research exists to protect |

### Shortlisted Platforms

#### 1. Fly.io (Recommended)

Already configured and working in this repo with no changes needed to the Dockerfile. Strongest GA coverage of persistent-process and WebSocket/TCP behavior of any researched platform, GA CLI, and agent-readable docs (GitHub markdown + `llms.txt`). The database decision moved off Fly entirely: Managed Postgres's $38/mo floor and the backup/upgrade burden of self-hosting a Postgres Machine are both avoided by pairing the backend with Supabase's free managed Postgres instead — at the cost of a cross-vendor network hop and Supabase's free-tier auto-pause behavior (tracked in the risk register).

#### 2. Railway

Scored essentially tied with Fly.io before the database decision, and remains the strongest fallback: a genuinely GA, fully managed Postgres template that's co-located with compute — no cross-vendor hop, no pause-on-inactivity risk — and its MCP server is live today, not just documented as a pattern. The tradeoffs are billing that's time-based rather than scale-to-zero (realistically ~$25-35/mo regardless of traffic) and no scripted rollback.

#### 3. Render

The cheapest realistic floor (~$13-20/mo on paid Starter + paid Postgres, avoiding the free-tier Postgres's 30-day expiry), and Docker/JVM support is explicitly recommended in its own docs. Loses out mainly on the two criteria this research is built around: its documentation isn't confirmed to be agent-readable (closed-source docs site, no markdown source found), and it has no official MCP integration — only an unofficial community wrapper.

## Anti-Bias Cross-Check: Fly.io + Supabase (free tier)

### Devil's Advocate — Weaknesses

1. **Free-tier auto-pause is the single biggest new risk.** A Supabase free project pauses after 7 days with no traffic; unlike a Fly cold start, nothing about an incoming request automatically wakes it back up — someone has to manually un-pause it from the Supabase dashboard before the app works again.
2. **Two platforms, two consoles, two failure domains.** Compute (Fly) and data (Supabase) now live in entirely separate systems — troubleshooting "why is the app down" means checking two dashboards/CLIs instead of one, and an outage on either side looks identical from the app's perspective (a failed DB connection).
3. **Free-tier caps are real, with no documented auto-upgrade path.** 500MB database storage and 2 free projects per org; hitting the storage cap silently blocks writes rather than failing loudly in advance.
4. **Fly's outbound IP to Supabase isn't static by default.** The connection depends on Fly Machines' non-static outbound IPv6; if Supabase ever requires IP allowlisting on a future tier, or the connection drops during a Fly host migration, HikariCP's reconnect behavior hasn't been tuned for this specific external hop the way it would be for a private, co-located connection.
5. **`ddl-auto=update` risk is now against a database you don't control at the infra level.** Supabase's own maintenance windows or Postgres version upgrades happen on their schedule, with less visibility than a self-hosted or Fly-managed instance would give.

### Pre-Mortem — How This Could Fail

Six months in, GymTrack's biggest incident wasn't technical — it was a Tuesday morning realization that the app had been down for everyone since the previous Tuesday. The team had stopped touching it for over a week while focused on other certification coursework, and Supabase's free tier quietly paused the project after seven days of no traffic. Nobody was watching for this specifically: Fly's own logs showed the backend deploying and running fine, so the first debugging instinct was to check `fly status` and `fly logs`, both of which looked healthy. The actual failure was invisible from Fly's side entirely — every database connection attempt just failed, and it took checking the Supabase dashboard directly to discover the project had been paused for days. Un-pausing it took one click, but finding out which of the two platforms actually owned the problem took twenty minutes longer than it should have, precisely because compute and data lived in two unrelated systems with no shared view of "is everything actually up."

### Unknown Unknowns

- The pause trigger is just normal usage, not a bug or attack — a student focused on other coursework for a week is exactly the pattern that causes it.
- Fly's outbound IP to Supabase isn't static by default; if Supabase tightens security with IP allowlisting on a future tier, the connection could break with no code change on this project's side.
- Supabase's Supavisor pooler runs in "transaction mode" by default for serverless-style use, which doesn't support prepared statements — if connection limits ever force a switch to the pooler instead of the direct connection, Hibernate/JPA could throw confusing SQL errors unrelated to any actual application bug.
- There's no single "is my stack up" dashboard across Fly + Supabase — worth bookmarking both status pages rather than assuming Fly's health implies the database is reachable.

## Operational Story

- **Preview deploys**: Fly doesn't have PR-based preview URLs out of the box the way Vercel/Netlify/Cloudflare Pages do; the existing `ci_default_flow: auto-deploy-on-merge` hint in `tech-stack.md` means CI deploys straight to the one `gym-track` app on merge. A separate "staging" Fly app (different `fly.toml` app name) paired with a second free Supabase project is the practical way to get a preview environment if one is needed later — not automatic today.
- **Secrets**: `fly secrets set KEY=value` stores secrets in Fly's own vault, injected as env vars at boot. This repo's `fly.toml`/`application.properties` already use `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` — point these at Supabase's connection string (direct IPv6 connection; see Getting Started) instead of a Fly-hosted database. Only someone with `fly` CLI access to the app can read/set them; rotation is a manual `fly secrets set` + redeploy. Supabase's own project API keys/service-role key, if ever needed, live separately in the Supabase dashboard.
- **Rollback**: no single rollback command on the Fly side. Pattern is `fly releases` (or `fly releases --image`) to find a prior image reference, then `fly deploy --image <old-image>` to redeploy it. Typical time-to-revert is one deploy cycle. Caveat: a schema change applied via `ddl-auto=update` does **not** roll back automatically when the app image is reverted — the database shape can be ahead of a rolled-back app version. There is no Fly-side rollback for the database at all now that it's external; any schema revert has to happen directly against Supabase.
- **Approval**: production deploys (`fly deploy`), secret rotation, and any destructive action on the Supabase project (dropping tables, resetting the database, un-pausing after a billing-relevant gap) should stay human-approved. Routine `fly logs` / `fly status` / `fly releases` reads are safe for an agent to run unattended; so is checking Supabase's project status, but acting on a paused project should prompt a human first.
- **Logs**: `fly logs` (optionally `-a gym-track`) tails backend runtime logs directly from the CLI, read-only, no dashboard required. Database-side logs/metrics are only available through the Supabase dashboard — there's no CLI-first path for that half of the stack.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Supabase free project auto-pauses after 7 days of inactivity | Devil's advocate / Pre-mortem | H | M | Expect this for a low-traffic educational project; document the one-click un-pause step in the dashboard, or set up a trivial periodic health-check ping if the gap becomes disruptive |
| Troubleshooting is split across two platforms with no shared status view | Devil's advocate | M | M | Bookmark both `fly status`/`fly logs` and the Supabase project dashboard; when the backend looks healthy but requests fail, check Supabase's pause state first |
| JVM backend cold start races Fly's TCP-only health check, serving a half-initialized app | Research finding (Fly.io report) | M | M | Prefer `auto_stop_machines="suspend"` over `"stop"` for faster resume, and/or tune JVM startup (`-XX:MaxRAMPercentage`), and/or set `min_machines_running=1` if cold starts prove unacceptable |
| No scripted/one-command rollback on Fly | Research finding | L | M | Document the `fly releases` + `fly deploy --image <old>` pattern as a runbook step now, before it's needed under pressure |
| `ddl-auto=update` schema change doesn't roll back with the app image, and now has no Fly-side database rollback either | Pre-mortem | L | H | Treat any schema-changing deploy as one-way; take a manual Supabase backup/export immediately before deploying a change that alters the schema |
| Free-tier storage cap (500MB) or project-count cap (2/org) hit without warning | Devil's advocate | L | M | Monitor database size periodically via the Supabase dashboard; budget for Supabase Pro ($25/mo, no pausing) if the project outgrows free-tier limits |
| Fly's official MCP server doesn't cover deploys and has no maturity label | Research finding (corrected) | L | L | Use the official `fly mcp server` (apps/logs/machine/secrets/status/volumes) for agent-driven inspection and management, but keep `fly deploy` on the CLI directly for actually shipping releases |

## Getting Started

1. Confirm `flyctl` is installed and authenticated (`fly auth whoami`); the app already exists as `gym-track` per the committed `fly.toml`.
2. Create a free Supabase project (supabase.com dashboard) and grab its Postgres connection details from Project Settings → Database. Use the **direct connection** string (resolves to IPv6) rather than paying for Supabase's IPv4 add-on — Fly Machines have outbound IPv6 by default, so this should work without extra configuration.
3. Set the existing secret keys to point at Supabase instead of a Fly-hosted database: `fly secrets set DB_HOST=<supabase-host> DB_PORT=5432 DB_NAME=postgres DB_USER=<supabase-user> DB_PASSWORD=<supabase-password>` — these are the same keys `application.properties` and `fly.toml` already reference, so no code changes are needed.
4. Deploy the backend as already configured: `fly deploy` from the repo root (uses the existing multi-stage Dockerfile).
5. Verify with `fly logs` and `fly status`, and separately confirm the Supabase project shows as active (not paused) in its dashboard before the first real session against it.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
