# Dashboard UI design-system contract — Plan Brief

> Full plan: `context/changes/dashboard-ui-contract/plan.md`
> Research: `context/changes/dashboard-ui-contract/research.md`

## What & Why

The dashboard renders correctly but was built feature by feature: the chart ignores the theme, the main button has poor contrast in dark mode, buttons have no focus ring, disabled buttons look enabled, and loading is plain text. We extend the repo's existing CSS-variable system and clean this one view so later views inherit a contract instead of copying drift.

## Starting Point

Tokens live in `frontend/src/index.css` (colours and shadow only, light plus dark). Shared button/card/field styles are classes in `page.css`, used on 36 other call sites. The dashboard view has no hard-coded literals; the gaps are missing tokens (on-accent, radius, ring, chart), missing states, and Recharts defaults. Playwright, oxlint and vitest exist; screenshot tests do not.

## Desired End State

On `/`, every colour and radius comes from a token in both themes; "Start workout" is the first thing under the title and readable (at least 4.5:1); buttons and links show a tokenised focus ring; disabled buttons look disabled; the chart follows the theme; loading shows skeleton blocks with no jump. A Playwright spec guards desktop and 375px in light and dark, `CLAUDE.md` holds the UI rule, and `npm run check:tokens` fails on literals in the cleaned files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Design-system variant | Extend existing CSS variables; no shadcn/Tailwind init | The repo already has tokens and shared classes; a second system would create drift | Research |
| Accent contrast | Darker light `--accent` (about `#9d2ff5`) plus `--on-accent`; dark keeps `#c084fc` with dark text | Fixes the CTA at the token layer for all 36 button uses and keeps the purple | Plan |
| Primary CTA | Move "Start workout" directly under the title | Visible without scrolling on a phone | Plan |
| Loading | Token-based skeleton blocks | No layout jump, works in both themes, CSS only | Plan |
| Focus and disabled | Global `--ring` on shared classes in `page.css` | One contract every page inherits | Plan |
| Gate and guard | Playwright `toHaveScreenshot` plus state assertions, `CLAUDE.md` rule, Node `check:tokens` script | Uses tooling already present; no new dependency | Plan |
| Chart colours | One `chartTheme.ts` shared by weekly and progression charts | Same Recharts defaults are used in both | Research |

## Scope

**In scope:** token additions in `index.css`; shared button/input states in `page.css`; dashboard view, its three components, both charts; moving `.muscle-*` styles; new e2e spec; `CLAUDE.md` rule; `check:tokens` script.

**Out of scope:** other views' layout; `topbar.css` overlay colour; `8px` literals in other stylesheets; dark-mode toggle; sticky mobile CTA; new dependencies.

## Architecture / Approach

Tokens first (aliases on `:root` so the dark override keeps working), then shared states, then the view, then the gate. Raw values and contrast figures are also saved in `tokens.md` in the change folder. The view uses a shared `.card` and neutral `.stat-*` classes, a skeleton component set, and one chart theme helper.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Token values | `--on-accent`, `--radius`, `--ring`, chart tokens, deeper light accent | Accent shade also changes badges, bars and other pages |
| 2. Shared states | Focus-visible, disabled, hover on shared classes; styled goal input | Global change on 36 call sites needs a quick visual check |
| 3. Dashboard view | Themed charts, CTA under title, skeleton, `.card`/`.stat-*`, moved muscle styles | Moving CSS and the CTA can break existing e2e specs |
| 4. Matrix, gate, guard | Screenshot and state spec, `CLAUDE.md` rule, `check:tokens` | Screenshot baselines are platform-specific |

**Prerequisites:** local Postgres (`podman-compose up -d`) for e2e; Node and the existing `frontend/` toolchain.
**Estimated effort:** about 3-4 sessions across 4 phases.

## Open Risks & Assumptions

- Dark-mode accent stays `#c084fc` (6.77:1 with dark text); only the light accent changes. If you want a different brand shade, change it in Phase 1.
- Screenshot baselines are generated on this Windows machine; a Linux CI would need its own baselines.
- The 3.1:1 axis-label figure came from an assumed `#666` default; the library source confirms `#666` for the axis line, the tick fill is not separately verified.

## Success Criteria (Summary)

- Dashboard readable and visibly focusable in light and dark, desktop and 375px.
- No literal colours in the cleaned files; `npm run check:tokens` and the full e2e suite pass.
- The next agent finds the UI rule in `CLAUDE.md` and the tokens in `index.css`.
