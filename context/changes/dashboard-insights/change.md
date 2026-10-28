---
change_id: dashboard-insights
title: Dashboard insights: trends, PRs and consistency
status: impl_reviewed
created: 2026-10-27
updated: 2026-10-28
archived_at: null
---

## Notes

extend the dashboard with (1) comparison vs the previous period on each tile, (2) weekly volume trend chart (last 8-12 weeks), (3) recent personal records list (builds on personal-record-flag), (4) consistency: weekly streak plus weekly workout goal. Likely extends DashboardStatsResponse/DashboardService and DashboardPage.tsx; consider adding a longer window (90 days / all time) and a chart approach (Recharts or hand-rolled SVG).
