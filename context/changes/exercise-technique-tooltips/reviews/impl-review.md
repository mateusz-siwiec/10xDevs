<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Technique tooltips for predefined exercises

- **Plan**: context/changes/exercise-technique-tooltips/plan.md
- **Scope**: Full plan (4 of 4 phases)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-11-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 6 warnings, 4 observations

Automated criteria re-run on HEAD: `npm test` 35 passed, `npm run build` ok, `npm run lint` only the 2 existing AuthContext warnings, `npm run check:tokens` ok, `npm run test:e2e` 51 passed. Manual items 1.4-1.5, 2.4-2.5, 3.5-3.7 and 4.4 are ticked on the user's confirmation.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Enter/Space closes a panel that focus just opened; stale pointerType ref

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/TechniqueTooltip.tsx:84-89, 107-109
- **Detail**: Tab focus opens the panel through `onFocus`. Enter or Space then fires `click` with `pointerType.current === ''`, so `onClick` toggles it shut and `aria-expanded` flips to false. Separately, `pointerType` is only cleared inside `onClick`; if `pointerdown` happens without a `click` (drag off the button), a later keyboard Enter takes the mouse "keep open" branch.
- **Fix**: In `onClick`, treat keyboard clicks (`event.detail === 0`) as "keep open" and clear `pointerType` on `pointerleave`/`pointercancel`.
  - Strength: Fixes the natural Tab-then-Enter flow; Escape and blur still close it.
  - Tradeoff: Keyboard users can no longer toggle it closed with Enter, only with Escape or by tabbing away.
  - Confidence: HIGH — read directly from the handlers.
  - Blind spot: Screen-reader virtual-cursor clicks also report `detail === 0`.
- **Decision**: FIXED — keyboard clicks keep the panel open; pointerType cleared on pointerleave

### F2 — Escape always moves focus to the trigger

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/TechniqueTooltip.tsx:33-37
- **Detail**: The Escape listener on `document` always calls `buttonRef.current?.focus()`. When the panel was opened by hover only, Escape pulls focus away from whatever the user was using (a select, an input).
- **Fix**: Only refocus the button when `document.activeElement` is inside the component's root.
- **Decision**: FIXED — Escape refocuses the trigger only when focus is already inside the component

### F3 — Blur with a null relatedTarget leaves the panel open

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/TechniqueTooltip.tsx:68-71
- **Detail**: `onBlur` closes only when `relatedTarget` is non-null and outside the root. Tabbing into browser chrome or switching windows blurs with `relatedTarget === null`, so the panel stays open. Closing on every null blur would also close it when the user clicks plain text inside the panel.
- **Fix**: Close when `relatedTarget` is null or outside the root, unless the root is currently hovered (`rootRef.current?.matches(':hover')`).
  - Strength: Panel closes on keyboard blur but survives clicks on its own text.
  - Tradeoff: Relies on `:hover`, which is false on touch; touch relies on the outside-mousedown handler.
  - Confidence: MED — behaviour differs slightly across browsers.
  - Blind spot: Not verified in Safari/Firefox.
- **Decision**: FIXED — blur closes on null/outside relatedTarget unless the component is hovered

### F4 — Panel shift is never reset or re-measured

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/components/TechniqueTooltip.tsx:47-58
- **Detail**: The layout effect depends only on `[open]`. A window resize, rotation or language change while open leaves a stale `shift`, and the previous shift is still in state when the panel reopens.
- **Fix**: Reset `shift` to 0 when closing and re-measure on `resize` while open.
- **Decision**: FIXED — shift reset on close, re-measured on resize while open

### F5 — Literal radius `999px` breaks the "no literal radii" rule

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/styles/page.css:245
- **Detail**: CLAUDE.md says no literal colours, radii or arbitrary values. `border-radius: 999px` is a literal radius; `check:tokens` does not catch it because its patterns only match hex, colour functions, bracketed values and palette classes.
- **Fix**: Use `var(--radius)` (or `50%`, since the trigger is a square) instead of `999px`.
- **Decision**: FIXED — border-radius uses var(--radius)

### F6 — Tests miss the keyboard, blur and outside-click paths

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: frontend/e2e/exercises-list.spec.ts (technique tooltip tests), frontend/e2e/technique-tooltip.spec.ts:44-76
- **Detail**: No test presses Enter/Space after focus opened the panel (would have caught F1) or tabs away. The outside-click test hovers the trigger first, so moving the mouse away already closes it and the outside-mousedown handler is never uniquely proven. The substitutes test only checks the trigger exists, and the heading assertion is weak.
- **Fix**: Add tests for Tab then Enter, Tab-away closing, an outside click on a keyboard-opened panel, and a cue assertion in the substitutes panel. Do this together with F1-F3.
  - Strength: Locks the interaction contract the component has no unit tests for.
  - Tradeoff: More specs to maintain, and hover/keyboard timing needs care.
  - Confidence: HIGH — gaps read from the specs.
  - Blind spot: Flakiness of keyboard-focus tests on other platforms.
- **Decision**: FIXED — added Enter/Space, null-blur, hover-Escape focus, keyboard outside-click and substitutes cue specs; each F1-F3 break turns one red

### F7 — Block elements nested inside spans

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/components/TechniqueTooltip.tsx:91-144
- **Detail**: The root is a `span` containing a `div`, `p` and `ul`, rendered inside `span.plan-item-name` and `span.substitute-item-name`. Browsers tolerate it, but it is invalid content-model nesting.
- **Fix**: Make the panel and heading `span` elements with `display: block`, or keep as is and accept it.
- **Decision**: ACCEPTED — kept the markup, documented the trade-off in a comment in TechniqueTooltip.tsx

### F8 — Margin gap between trigger and panel

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: frontend/src/styles/page.css:262-275
- **Detail**: `.technique-panel` has `margin-top: 0.25rem` outside both elements, which can fire `pointerleave` when crossing it (WCAG 1.4.13 hoverable). The trigger's 44px `::after` hit area covers most of the gap directly under the button, so the risk is limited to diagonal movement.
- **Fix**: Replace the margin with a transparent top padding/border on the panel.
- **Decision**: FIXED — transparent ::before bridge above the panel keeps the pointer inside the component

### F9 — Polish wording nits in a few cues

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/i18n/locales/pl.json (exerciseTechnique)
- **Detail**: No unsafe advice found. Wording that reads awkwardly: skull-crusher cue 4 ("nie poruszając ramionami", English says upper arms), overhead-triceps-extension cue 4 (redundant), ab-wheel-rollout cue 3 ("Jedź tylko tak daleko"), hip-thrust cue 2 ("goleń" singular), calf raises ("Wspinaj się na palce"), deadlift cue 2 ("napięte plecy" for lats tight).
- **Fix**: Edit those cues in `pl.json`, e.g. "nie ruszając górną częścią ramion", "Rozwijaj tylko tak daleko", "golenie ustawione pionowo", "Unoś pięty".
- **Decision**: FIXED — reworded 8 Polish cues (skull-crusher, overhead-triceps-extension, ab-wheel-rollout, hip-thrust, 3 calf raises, deadlift)

### F10 — Redundant non-null assertion and dead `:disabled` style

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/pages/WorkoutPage.tsx:316-318, frontend/src/styles/page.css:`.technique-trigger:disabled`
- **Detail**: `exercisesById.get(selectedExercise)!` repeats the lookup that the `&&` guard just did. The trigger is never disabled, so `.technique-trigger:disabled` is unused (kept to satisfy the "disabled state" UI rule).
- **Fix**: Hoist `const selected = selectedExercise ? exercisesById.get(selectedExercise) : undefined` and drop the `!`; leave the disabled rule.
- **Decision**: FIXED — lookup hoisted to selectedItem, non-null assertion removed, :disabled style kept
