---
change_id: workout-ui-contract
title: Workout UI design-system contract
status: implemented
created: 2026-10-30
updated: 2026-10-30
archived_at: null
---

## Notes

- **View:** `WorkoutPage` (`/workout`, `frontend/src/pages/WorkoutPage.tsx`) with its components (`SetLogger`, `SessionSetList`, `RestTimer`, `PlanWalkthrough`, `PreviousWorkoutHint`, `ProgressionRecommendation`, `SubstituteSuggestions`, `ExercisePicker`) and `frontend/src/styles/workout.css`.
- **Token source:** `frontend/src/index.css`, extended by `dashboard-ui-contract` (`--on-accent`, `--radius`, `--radius-card`, `--ring`, `--chart-*`); values recorded in `context/changes/dashboard-ui-contract/tokens.md`.
- **Contract variant:** existing design system (plain CSS variables); reuse the shared classes in `frontend/src/styles/page.css` (`.btn-*`, `.card`, `.stat-*`, `.skeleton`, `.visually-hidden`). No new dependency.
- **Sibling changes (one view each, not in this change):** `/plans` (`plans-ui-contract`), `/exercises` (`exercises-ui-contract`).
- **Pre-audit (to be confirmed in research.md `## Charges`):**
  - Literal colour: `workout.css:83` `#fff` on `--danger` (needs a token, e.g. `--on-danger`).
  - 9 `border-radius: Npx` literals in `workout.css`.
  - 1 `focus-visible` rule and 0 `:disabled` rules in `workout.css`; check which controls use the shared classes.
  - Loading branch `if (loading)` in `WorkoutPage.tsx:213` (check for layout jump / text-only loading).
  - `check:tokens` does not cover these files yet.
