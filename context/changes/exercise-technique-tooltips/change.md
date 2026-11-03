---
change_id: exercise-technique-tooltips
title: Technique tooltips for predefined exercises
status: implementing
created: 2026-11-03
updated: 2026-11-03
archived_at: null
---

## Notes

Predefined exercises get a short cue list (3-4 concise steps) on proper technique, in Polish and English via the existing i18next locales keyed by exercise slug (no DB/API change). Shown as a keyboard-accessible tooltip (hover/focus/tap) in the exercises list and during a workout (WorkoutPage). Custom exercises show no tooltip. Must use design tokens (npm run check:tokens) and have hover/focus-visible/disabled states; add a locales test that every predefined slug has pl+en text, and Playwright coverage.
