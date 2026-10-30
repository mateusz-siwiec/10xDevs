---
date: 2026-10-30T10:20:00+01:00
researcher: Claude (Sonnet 5.5)
git_commit: dda42d7
branch: main
repository: 10xDevs
topic: "Dashboard UI audit: which charges feed the design-system contract change"
tags: [research, ui, dashboard, tokens, focus, dark-mode]
status: complete
last_updated: 2026-10-30
last_updated_by: Claude (Sonnet 5.5)
---

# Research: Dashboard UI audit (`dashboard-ui-contract`)

**Date**: 2026-10-30T10:20:00+01:00
**Researcher**: Claude (Sonnet 5.5)
**Git Commit**: dda42d7 (working tree has an unrelated `.gitignore` change)
**Branch**: main
**Repository**: 10xDevs

## Research Question

Audit `DashboardPage` in both directions (source → views, view → source) against the 3 charge categories of `/10x-ui`, and give 3–5 charges with file, line and user impact.

## Summary

- **Variant:** existing design system made of plain CSS variables. Values live in `frontend/src/index.css:1-50` (`:root` plus a `prefers-color-scheme: dark` override). There is no `components/ui`; shared primitives are CSS classes in `frontend/src/styles/page.css`.
- **Hard-coded scan** (the `/10x-ui` grep) on `DashboardPage.tsx`, `dashboard.css`, `ConsistencyCard.tsx`, `RecentRecords.tsx`, `WeeklyVolumeChart.tsx`: 0 hits. The view already reads tokens (17 `var(--…)` uses in `dashboard.css`). The only literal in the shared styles it depends on is `#fff` at `page.css:74`.
- **The gaps are in the contract itself**, not in literals inside the view: no on-accent, radius, spacing or ring tokens; chart library defaults bypass the tokens; interactive states are defined for only a few controls.
- 5 charges below, each mapped to a plan phase.

## Detailed Findings

### Source → views (token usage)

- Tokens defined: `--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`, `--accent-bg`, `--accent-border`, `--social-bg`, `--danger`, `--success`, `--shadow`, fonts (`index.css:2-18`); dark values at `index.css:36-50`.
- Not tokenised (inspected set: `index.css`, `page.css`, `dashboard.css`): radius (`8px` appears 18 times across `frontend/src/styles/*.css`, `999px` 4, `12px` 1, `6px` 1), spacing (rem literals throughout), text-on-accent.
- Components imported by the view: three local components (`ConsistencyCard`, `RecentRecords`, `WeeklyVolumeChart`); no shared card component.

### Charge 1: chart bypasses tokens (Missing tokens)

- `WeeklyVolumeChart.tsx:23-24` sets only `fontSize` on `XAxis`/`YAxis`; `:25-30` uses `Tooltip` with no style props. Only the grid (`:22`) and bar (`:31`) use `var(--border)` / `var(--accent)`.
- Inference, not verified in `node_modules`: Recharts defaults to a grey `#666` tick fill and a white tooltip box. `#666` on the dark `--bg` `#16171d` computes to about 3.1:1 (below the 4.5:1 text minimum). `ProgressionChart.tsx:71-85` has the same pattern, so the fix is shared.
- Impact: in dark mode the axis labels are hard to read and the tooltip is a bright white box.
- Token that should cover it: `--text` for ticks, `--bg`/`--border`/`--text-h` for the tooltip.

### Charge 2: text on accent and unnamed radius (Missing tokens)

- `page.css:74`: `.btn-primary` has `color: #fff` on `background: var(--accent)`. Computed contrast: white on `#aa3bff` (light) 4.39:1; white on `#c084fc` (dark) 2.64:1. Both are below 4.5:1 for normal-size text.
- Impact: the "Start workout" CTA (`DashboardPage.tsx:250`) is hard to read, worst in dark mode.
- Missing tokens: `--on-accent` (value differs per theme) and `--radius` (`8px`, used at `dashboard.css:37,108` and in `page.css`).

### Charge 3: focus-visible and disabled are not covered (States)

- `focus-visible` rules exist only for `.field input` (`page.css:54`), `.history-filter select` (`history.css:31`) and `.workout-select` (`workout.css:23`). No `focus-visible` rule for `.btn-primary`, `.btn-secondary`, links, or the window toggle (`dashboard.css:16-21`). No `--ring` token exists.
- `.btn-secondary:disabled` exists only as a pager-scoped rule (`history.css:91`). `ConsistencyCard.tsx:60,65` disables Save/Clear and `page.css` gives `.btn-secondary` no disabled style, so they look enabled. The goal `<input>` (`ConsistencyCard.tsx:56`) sits in `.consistency-label`, not `.field`, so it gets none of the `.field input` styles at all.
- Hover: `.btn-secondary:hover` changes only the border colour (`page.css:105`).
- Impact: keyboard users get the browser default ring, inconsistent with inputs; Save/Clear look clickable while disabled.
- Error state is present and tokenised (`.error-text` → `--danger`, `role="alert"`, `DashboardPage.tsx:156,196`).

### Charge 4: loading and layout order (Accidental architecture)

- Two independent plain-text loading states: `DashboardPage.tsx:153` (stats) and `:192` (insights). Both are replaced by blocks of different height (tiles, a 220px chart at `WeeklyVolumeChart.tsx:24`, forms), so layout shifts on arrival. Grep `skeleton` in `frontend/src/styles`: 0 hits.
- "Start workout" is the last element in `<main>` (`DashboardPage.tsx:250`), after stats, chart, goal form and records.
- Empty states are real, not blank (`DashboardPage.tsx:160-166`, `RecentRecords.tsx:26`, `WeeklyVolumeChart.tsx:44`).

### Charge 5: misplaced and duplicated styles; no agent rule

- `dashboard.css:155-199` holds `.muscle-*` rules for `MuscleGroupStatsPage`, not the dashboard.
- `ConsistencyCard.tsx:27,31` reuses `.dashboard-tile-value` / `.dashboard-tile-label` outside a tile.
- The card pattern (`border: 1px solid var(--border); border-radius: 8px`) is written separately in `.dashboard-tile` (`dashboard.css:36-37`) and `.recent-records li` (`:107-108`).
- `CLAUDE.md` has no UI/token rule section. No `AGENTS.md` or `.cursor/` in the repo root.
- Impact: a card change needs several edits and new views copy the drift.

## Code References

- `frontend/src/index.css:1-50` - token source (light + dark)
- `frontend/src/styles/page.css:54,69-95,96-111` - input focus rule, `.btn-primary` (`#fff` at 74), `.btn-secondary`
- `frontend/src/styles/dashboard.css:30-38,101-109,149-153,155-199` - cards, mobile breakpoint, misplaced `.muscle-*`
- `frontend/src/components/WeeklyVolumeChart.tsx:20-31` - chart without token colours
- `frontend/src/components/ProgressionChart.tsx:71-85` - same pattern, outside this view
- `frontend/src/components/ConsistencyCard.tsx:27-72` - disabled controls, reused tile classes
- `frontend/src/pages/DashboardPage.tsx:153,192,245-252` - loading text, CTA position

## Architecture Insights

- The token layer is flat roles already theme-switched; extending it (`--on-accent`, `--radius`, `--ring`) fits the existing pattern and needs no new tooling.
- Playbook: restyle of one view plus a focus pass, token layer first.

## Historical Context (from prior changes)

- `context/changes/` contained only this change at research time. `context/archive/` was not searched for UI decisions. `context/foundation/lessons.md` does not exist.

## Related Research

None.

## Open Questions

- Keep the brand `--accent` for the CTA (and change the text colour), or darken `--accent` in dark mode? A visual decision for `/10x-plan`.
- `RequireAuth.tsx` was not read in full; confirm logged-out and direct-link behaviour of the dashboard route during planning.
- Verify Recharts default tick colour and tooltip styling in `node_modules` before relying on the contrast figure in Charge 1.
- Moving "Start workout" up is a layout/product choice; decide in the plan.
- Visual gate: Playwright exists (`frontend/e2e/`, e.g. `mobile-menu.spec.ts`) but no screenshot tests; use a kitchen-sink page or `toHaveScreenshot` for this view only.

## Charges

| # | Category | Evidence | User impact | Plan phase | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Missing tokens | `WeeklyVolumeChart.tsx:23-30` | Dark-mode axis text ~3.1:1 (unverified default), white tooltip | Tokens, View | planned |
| 2 | Missing tokens | `page.css:74`, `dashboard.css:37,108` | CTA text 2.64:1 in dark, 4.39:1 in light | Tokens | planned |
| 3 | States | `page.css`, `history.css:91`, `ConsistencyCard.tsx:56-65` | No focus ring on buttons/links; disabled looks enabled | States | planned |
| 4 | Accidental architecture | `DashboardPage.tsx:153,192,250` | Layout jump; CTA at the bottom | View, States (loading) | planned; CTA reorder pending decision |
| 5 | Shared component / rule | `dashboard.css:155-199`, `ConsistencyCard.tsx:27,31`, `CLAUDE.md` | Duplicated card; next agent repeats drift | View, Leave a guard | planned |
