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

**Deploy on Fly.io, self-hosting PostgreSQL as a separate Fly Machine rather than using Fly Managed Postgres (MPG).**

Fly.io is the only researched platform that already has a working, unmodified deployment in this repo (`fly.toml` + the multi-stage Dockerfile) and the strongest GA story for a persistent JVM process (Docker/Java support, CLI, WebSocket/TCP proxying all GA, confirmed by direct research — not training-data assumption). The one weak point — Fly's own Managed Postgres product starting at $38/mo, which dwarfs the backend's own near-zero idle compute cost — was removed from the decision by explicitly choosing to self-host Postgres as an ordinary Fly Machine instead, which matches the stated cost-minimization priority from the interview. Railway is recorded as runner-up: it has a GA, fully managed Postgres template with none of the self-hosting operational burden noted in the risk register below, and is the natural fallback if that burden proves too much in practice.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Verdict |
|---|---|---|---|---|---|---|
| Cloudflare | Partial — container rollback unconfirmed in docs | Partial — no native Postgres (needs Supabase/Neon via Hyperdrive) | Pass — llms.txt + markdown, GA | Partial — no published max-duration for Containers | Partial — MCP is a platform strength but on the Workers/JS side, not applicable to Java ops | Technically capable (GA Containers since 2026-04-13) but fights the stated co-location preference and single-region answer removes its main edge advantage |
| Vercel | Pass — CLI is GA | Fail — Java path is Beta Container Runtime, scale-to-zero (5 min idle), no native Postgres (Neon via marketplace) | Partial | Fail — everything backend-relevant (Container Runtime, WebSockets) is Beta | Partial — MCP itself is Beta | Weakest fit for this stack; nothing backend-relevant is GA |
| Netlify | — | **Fail — no JVM runtime exists on any plan, ever** (Lambda-compat path is Node/Go only and is deprecated) | Pass (frontend docs only) | — | Pass (official MCP, frontend ops only) | **Hard-filtered out** — can only ever host the static React/Vite frontend, never the Spring Boot backend |
| **Fly.io** | Pass — `flyctl` GA, deploy/launch/logs all current; rollback is a documented two-step pattern (`fly releases` then `fly deploy --image`), not a single command | Pass for compute (managed Machines, automatic TLS/routing/scaling); self-hosted Postgres shifts backup/upgrade/monitoring burden onto the project (see risk register) | Pass — public markdown docs on GitHub (`superfly/docs`) plus `fly.io/llms.txt` | Pass — `fly deploy` is deterministic; rollback is a known, documented pattern | Partial — only unofficial third-party evidence of an MCP wrapper, not Fly-documented | **Recommended** — best balance once Postgres is self-hosted instead of using MPG |
| Railway | Partial — rollback is dashboard-only, not scripted | Pass — GA Docker auto-detection, one-click GA managed Postgres template | Pass — `railwayapp/docs` on GitHub, markdown | Partial — deploy is GA/deterministic, but Maven build-timeout limits are undocumented | Pass — official hosted MCP server (`mcp.railway.com`) live today | **Runner-up** — best all-around balance, held back mainly by time-based billing (~$25-35/mo regardless of traffic) and no scripted rollback |
| Render | Partial — thin CLI, no CLI rollback (dashboard/API only) | Pass — Docker/JVM explicitly recommended in official docs; managed Postgres is GA once on a paid plan (free Postgres expires after 30 days) | **Fail — closed-source docs site, no confirmed markdown/GitHub source** | Partial — deploys are deterministic via CLI/API; rollback is Dashboard/API only | **Fail — no official MCP, community wrapper only** | Cheapest realistic floor (~$13-20/mo) but weakest on the two criteria this research exists to protect |

### Shortlisted Platforms

#### 1. Fly.io (Recommended)

Already configured and working in this repo with no changes needed to the Dockerfile. Strongest GA coverage of persistent-process and WebSocket/TCP behavior of any researched platform, GA CLI, and agent-readable docs (GitHub markdown + `llms.txt`). The only real weakness — Managed Postgres's $38/mo floor — is sidestepped entirely by self-hosting Postgres as a plain Fly Machine, which is itself a well-trodden, documented pattern (`fly postgres create` / a Postgres Docker image as its own Fly app), at the cost of taking on backup/upgrade/monitoring responsibility manually (tracked in the risk register).

#### 2. Railway

Scored essentially tied with Fly.io before the self-hosting decision, and remains the strongest fallback: a genuinely GA, fully managed Postgres template removes every self-hosting risk in the register below, and its MCP server is live today, not just documented as a pattern. The tradeoffs are billing that's time-based rather than scale-to-zero (realistically ~$25-35/mo regardless of traffic) and no scripted rollback.

#### 3. Render

The cheapest realistic floor (~$13-20/mo on paid Starter + paid Postgres, avoiding the free-tier Postgres's 30-day expiry), and Docker/JVM support is explicitly recommended in its own docs. Loses out mainly on the two criteria this research is built around: its documentation isn't confirmed to be agent-readable (closed-source docs site, no markdown source found), and it has no official MCP integration — only an unofficial community wrapper.

## Anti-Bias Cross-Check: Fly.io (self-hosted Postgres)

### Devil's Advocate — Weaknesses

1. **Self-hosted Postgres means you own backups and recovery.** A single-node Postgres Machine has no automatic backups unless volume snapshots are configured manually — a corrupted or lost volume is simply lost data, with none of the managed safety net Fly MPG, Railway's template, or Render's managed Postgres would provide.
2. **A second cold-start problem, stacked on the first.** If the Postgres Machine is also configured to scale to zero, the backend's first request after idle could hit a database that hasn't finished booting yet — compounding the already-known JVM cold-start/TCP-health-check mismatch on the backend side.
3. **Version upgrades and disk monitoring become the project's job.** No managed product is tracking Postgres minor-version drift or disk growth for a self-hosted instance.
4. **Single point of failure.** One Machine, one volume, no replica — a host incident or volume corruption has no automatic failover.
5. **`ddl-auto=update` with no backup strategy sharpens an existing risk.** A bad schema change against a self-hosted database with no point-in-time recovery can mean genuine, permanent data loss.

### Pre-Mortem — How This Could Fail

Six months in, GymTrack's data layer became the actual risk, not the compute. The team self-hosted Postgres on Fly specifically to dodge Managed Postgres's $38/mo floor, running it as a single Machine with a single volume and no automated backup strategy. Everything was fine until a Fly host incident took the Postgres Machine down at the same time its volume reported corruption — there was no replica, no managed point-in-time recovery, and the last manual backup was three weeks old. Separately, `auto_stop_machines` had been left enabled on the database Machine to save cost; one morning a request timed out because the backend woke up before the database had finished booting, and `ddl-auto=update` silently tried to reconcile the schema against a half-ready connection. Nobody had tracked Postgres version upgrades, so it had quietly drifted two minor versions behind, and nobody noticed until an extension stopped working.

### Unknown Unknowns

- Fly's legacy single-node `fly postgres create` path and the newer Managed Postgres (MPG) product are genuinely different products with different support/update models — mixing guidance about one with the other is an easy and costly mistake.
- A self-hosted Postgres Machine's volume is tied to a specific physical host; changing regions or resizing can require a manual volume-migration step that a managed offering would automate.
- There is no Fly-provided "disk almost full" alerting for a self-hosted instance — that monitoring has to be built or wired up separately.
- MPG's own documented immaturity ("under development" patching/migration tooling) cuts both ways: self-hosting avoids depending on an immature managed product, but trades that for taking on the operational burden directly instead.

## Operational Story

- **Preview deploys**: Fly doesn't have PR-based preview URLs out of the box the way Vercel/Netlify/Cloudflare Pages do; the existing `ci_default_flow: auto-deploy-on-merge` hint in `tech-stack.md` means CI deploys straight to the one `gym-track` app on merge. A separate "staging" Fly app (different `fly.toml` app name) is the practical way to get a preview environment if one is needed later — not automatic today.
- **Secrets**: `fly secrets set KEY=value` stores secrets in Fly's own vault, injected as env vars at boot; this repo's `fly.toml` already documents the expected keys (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`). Only someone with `fly` CLI access to the app can read/set them; rotation is a manual `fly secrets set` + redeploy.
- **Rollback**: no single rollback command. Pattern is `fly releases` (or `fly releases --image`) to find a prior image reference, then `fly deploy --image <old-image>` to redeploy it. Typical time-to-revert is one deploy cycle (roughly the same time as a normal deploy). Caveat: a schema change applied via `ddl-auto=update` does **not** roll back automatically when the app image is reverted — the database shape can be ahead of a rolled-back app version.
- **Approval**: production deploys (`fly deploy`), secret rotation, and any destructive database action (dropping/recreating the self-hosted Postgres Machine) should stay human-approved. Routine `fly logs` / `fly status` / `fly releases` reads are safe for an agent to run unattended.
- **Logs**: `fly logs` (optionally `-a gym-track`) tails runtime logs directly from the CLI, read-only, no dashboard required — fits the CLI-first criterion well.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Self-hosted Postgres has no automatic backups | Devil's advocate | M | H | Configure Fly volume snapshots on a schedule, or export `pg_dump` to object storage periodically before relying on this in anything beyond the MVP |
| Backend wakes from scale-to-zero before self-hosted Postgres is ready (double cold-start) | Devil's advocate | M | M | Set `min_machines_running=1` on the Postgres Machine specifically (even if the backend keeps `auto_stop_machines`), so the database is never the thing waking up cold |
| JVM backend cold start races Fly's TCP-only health check, serving a half-initialized app | Research finding (Fly.io report) | M | M | Prefer `auto_stop_machines="suspend"` over `"stop"` for faster resume, and/or tune JVM startup (`-XX:MaxRAMPercentage`), and/or set `min_machines_running=1` if cold starts prove unacceptable |
| No scripted/one-command rollback | Research finding | L | M | Document the `fly releases` + `fly deploy --image <old>` pattern as a runbook step now, before it's needed under pressure |
| `ddl-auto=update` schema change doesn't roll back with the app image | Pre-mortem | L | H | Treat any schema-changing deploy as one-way; take a manual backup immediately before deploying a change that alters the schema |
| Self-hosted Postgres version/extension drift goes unnoticed | Unknown unknowns | L | M | Periodically check the running Postgres version against Fly's current recommended image tag |
| MCP support for Fly is unofficial/undocumented | Research finding | L | L | Don't depend on an MCP-based workflow for Fly ops yet; use `flyctl` directly |

## Getting Started

1. Confirm `flyctl` is installed and authenticated (`fly auth whoami`); the app already exists as `gym-track` per the committed `fly.toml`.
2. Create the self-hosted Postgres Machine as its own small Fly app (separate from `gym-track`), e.g. `fly postgres create --name gym-track-db --region iad`, and set `min_machines_running=1` on it so it never scale-to-zero's independently of the backend.
3. Attach it to the backend app: `fly postgres attach gym-track-db --app gym-track`, which sets the `DATABASE_URL`/connection secrets automatically — reconcile this with the existing `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` keys already referenced in `application.properties` and `fly.toml`.
4. Deploy the backend as already configured: `fly deploy` from the repo root (uses the existing multi-stage Dockerfile).
5. Verify with `fly logs` and `fly status`, and take a baseline manual backup (`pg_dump` via `fly postgres connect`) before the first real schema-bearing deploy.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
