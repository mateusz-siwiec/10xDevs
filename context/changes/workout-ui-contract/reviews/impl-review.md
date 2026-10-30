<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Workout UI design-system contract

- **Plan**: context/changes/workout-ui-contract/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Automated criteria were run during implementation: build, lint (only the 2 pre-existing AuthContext warnings), 16 unit tests, `check:tokens` (17 files), full e2e 26/26, guard-fail check, break-check. All manual items confirmed by the user.

Disclosed deviations (accepted, not findings): `.skeleton` moved dashboard.css -> page.css; LEGS -> CHEST/BACK/QUADS in the seed; the 999px pill rule was deleted because the skipped badge now uses `.pr-badge`.

## Findings

### F1 — Hover rule overrides the selected row's accent border

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/workout.css:230
- **Detail**: `.walkthrough-entry:hover:not(:disabled)` has specificity (0,3,0) and beats `.walkthrough-entry-selected` (0,1,0). Hovering the selected row swaps its `--accent` border for `--accent-border`. The plan said the selected styles stay as they are. The hover e2e test uses a row that is neither selected nor current, so it does not catch this.
- **Fix**: Change the selector to `.walkthrough-entry:hover:not(:disabled):not(.walkthrough-entry-selected)`.
- **Decision**: FIXED — added :not(.walkthrough-entry-selected) to the hover selector

### F2 — Loading test tolerance of 120px is loose

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: frontend/e2e/workout-ui.spec.ts:196
- **Detail**: The plan asked for "a small tolerance". The skeleton card is about 97px taller than the loaded start screen, so the check passes with ~23px of headroom and does not really prove "no big jump". Plan step 3.4 was confirmed by eye.
- **Fix A ⭐ Recommended**: Tighten the skeleton heights in `workout.css` (`.skeleton-block`) to match the start screen and lower the tolerance to about 24px.
  - Strength: The test then checks the stated goal.
  - Tradeoff: Needs a visual re-check of the skeleton; the baselines are not affected (no screenshot of the loading state).
  - Confidence: MED — the loaded height depends on whether the user has a saved plan.
  - Blind spot: Height differs between the plan and no-plan start screens (240px vs 175px).
- **Fix B**: Keep as is and leave the comment documenting the gap.
  - Strength: No work.
  - Tradeoff: The check protects little.
  - Confidence: HIGH — behaviour is already documented in the spec.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — .skeleton-block min-height 8rem -> 2rem, tolerance 120 -> 24px (spec passes)

### F3 — Skipped badge reuses `.pr-badge` with a different margin side

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/components/PlanWalkthrough.tsx:51
- **Detail**: `.pr-badge` is a record-specific name and has `margin-left` where the old badge had `margin-right`. Plan explicitly asked for this reuse. No baseline shows a skipped row.
- **Fix**: Leave as is, or add a neutral `.badge` alias later.
- **Decision**: FIXED — added neutral .badge alias to page.css, PlanWalkthrough uses it

### F4 — Date-dependent text is not masked in the default screenshots

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/e2e/workout-ui.spec.ts (default screenshot tests)
- **Detail**: The chart and e-mail are masked, but session or previous-workout dates could change between days. It only matters if such text renders in the seeded session. Linux baselines do not exist yet, so the CI run will fail until generated.
- **Fix**: Mask any date-bearing element if a baseline diff appears.
- **Decision**: FIXED — masked .previous-workout-hint in default screenshots (no baseline change, hint not in seed)
