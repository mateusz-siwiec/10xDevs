<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard UI design-system contract

- **Plan**: context/changes/dashboard-ui-contract/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-30
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Automated criteria re-run at review time: build, lint (only 2 pre-existing warnings in AuthContext.tsx), unit tests 16/16, check:tokens ok, e2e 16/16.

## Findings

### F1 — Palette-class pattern in the token guard never matches

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: frontend/scripts/check-hardcoded-values.mjs:30
- **Detail**: The pattern is built with new RegExp(`\b...`) inside a template literal, so `\b` becomes a backspace character, not a word boundary. Verified: it returns false for `bg-red-500`. Only the palette-class check is dead; hex, colour-function and arbitrary-value checks work (guard failure on `#123456` was confirmed). Harmless today (no Tailwind in repo) but the guard claims to cover it.
- **Fix**: Use String.raw`\b[a-z-]+-(?:${PALETTES})-(?:50|[1-9]00|950)\b` (or double the backslashes).
- **Decision**: FIXED (Fix now: String.raw so the word-boundary escape works; verified bg-red-500 now fails the guard)

### F2 — Dead CSS rule `.dashboard-section .skeleton + .skeleton`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/dashboard.css:165
- **Detail**: Each skeleton block sits in its own `.dashboard-section`, so no skeleton is ever an adjacent sibling of another. Rule never applies.
- **Fix**: Delete the rule.
- **Decision**: FIXED (rule deleted)

### F3 — Literals left in chartTheme.ts are outside the guard's reach

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: frontend/src/components/chartTheme.ts:4
- **Detail**: `fontSize: 12`, `'1px solid ...'` and dasharray `'3 3'` remain as literals. They are not colours or radii, so they fit the plan's guard scope, but they are not tokenised.
- **Fix**: Accept; revisit only if a font-size/border-width token is introduced.
- **Decision**: SKIPPED (accepted as is)
