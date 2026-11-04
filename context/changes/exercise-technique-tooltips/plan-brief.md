# Technique tooltips for predefined exercises — Plan Brief

> Full plan: `context/changes/exercise-technique-tooltips/plan.md`

## What & Why

Predefined exercises should teach proper technique. Each one gets a short cue list (3-4 steps) in Polish and English, shown as a tooltip in the exercises list, during a workout and in the substitutes panel, so users can check form without leaving the screen.

## Starting Point

The 40 seeded exercises have stable slugs, and the app already translates their names from `exercises.<slug>` in the i18next locale files. There is no tooltip component. During a workout the current exercise is only shown in a native `<select>` and in plan walkthrough buttons, neither of which can hold a nested control.

## Desired End State

Built-in exercises show a small info button in the three places. Hover, focus or tap opens the cue list in the active language; Escape, outside click or leaving focus closes it. Custom exercises show nothing.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where text lives | Locale JSON `exerciseTechnique.<slug>` (array of cues) | App is already bilingual; no DB/API change | Plan |
| Languages | Polish and English | Matches existing i18n | Plan |
| Content shape | 3-4 short cues per exercise | Fits a tooltip, easy to test | Plan |
| Workout placement | Info button beside the picker, for the selected exercise | Native select and walkthrough buttons cannot host it; works for free-form and plan workouts | Plan |
| Interaction | Hover + focus + tap toggle; Escape/outside/blur close | Matches "tooltip" wording and works on touch and keyboard | Plan |
| Scope | List + workout picker + substitutes panel | Where users meet an unfamiliar exercise; plan editor excluded | Plan |
| Content QA | Claude drafts, user reviews in PR; no disclaimer | Fast, wording checked by someone who trains | Plan |

## Scope

**In scope:** locale content for 40 slugs x en/pl, lookup helper, `TechniqueTooltip`, three placements, locale tests, Playwright specs, `check:tokens` coverage.

**Out of scope:** DB/API changes, plan editor, history, custom exercise form, media, user-edited technique text, replacing the native select, disclaimer text.

## Architecture / Approach

One helper `exerciseTechnique(exercise)` returns `string[] | null`. `TechniqueTooltip` renders nothing for `null`, so custom exercises need no special handling. The component follows the `ExercisesMenu` popover behaviour and uses tokens from `index.css` through shared classes in `page.css`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Content and lookup | 80 texts, helper, completeness tests | Wording quality (needs user review) |
| 2. TechniqueTooltip | Accessible hover/focus/tap component, tokens only | Clipping/overflow on 390px screens |
| 3. Placements | Trigger in list, workout picker row, substitutes | Breaking the list row layout from the current branch |
| 4. Playwright | Open/close, custom, language, workout, substitutes specs | Flaky hover tests |

**Prerequisites:** commit or merge the uncommitted `ExercisesPage`/`exercises.css` work on `fix/exercises-row-layout`; Postgres for e2e.
**Estimated effort:** ~2-3 sessions across 4 phases.

## Open Risks & Assumptions

- Hover has no touch equivalent, so tap toggle is required; hover behaviour is hard to test reliably.
- Technique wording is generic guidance written by an AI and must be reviewed by the user.
- Adding the info button to list rows may shift the layout fixed on `fix/exercises-row-layout`.

## Success Criteria (Summary)

- Every built-in exercise shows correct cues in Polish and English in the list, workout and substitutes panel.
- Custom exercises show no tooltip; keyboard and touch users can open and close it.
- Tests, lint, build and `check:tokens` all pass.
