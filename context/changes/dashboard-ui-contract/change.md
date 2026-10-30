---
change_id: dashboard-ui-contract
title: Dashboard UI design-system contract
status: implemented
created: 2026-10-30
updated: 2026-10-30
archived_at: null
---

## Notes

- **View:** `DashboardPage` (`frontend/src/pages/DashboardPage.tsx`) with its components `WeeklyVolumeChart`, `ConsistencyCard`, `RecentRecords` and `frontend/src/styles/dashboard.css`.
- **Token source:** `frontend/src/index.css` (`:root` + `prefers-color-scheme: dark`).
- **Contract variant:** existing design system (plain CSS variables) — extend it; no Tailwind/shadcn init. Candidate additions: `--on-accent`, `--radius`, chart tokens, `--ring`.
- **Pre-audit charges (to be confirmed in research.md `## Charges`):**
  1. Chart not on tokens: `WeeklyVolumeChart.tsx:23-25` (axis tick colour, default white Tooltip) — poor dark-mode contrast.
  2. `#fff` on `--accent` (`page.css:74`), plus literal radius/spacing (`dashboard.css:37,108`) — low contrast of the primary CTA in dark mode.
  3. Missing focus-visible on buttons/links/toggle; `.btn-secondary:disabled` only in `history.css:91` — Save/Clear look enabled.
  4. Separate text "loading" states (`DashboardPage.tsx:153,192`) cause layout jump; "Start workout" CTA buried at the bottom (`:250`).
  5. Misplaced/duplicated styles: `.muscle-*` in `dashboard.css:155-199`, tile/record card pattern copied, no UI rule in `CLAUDE.md`.
- Hard-coded scan on view files: 0 hits in the dashboard view; `page.css:74` `#fff`.
