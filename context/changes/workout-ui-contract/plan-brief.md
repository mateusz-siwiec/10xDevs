# Workout UI design-system contract — Plan Brief

> Full plan: `context/changes/workout-ui-contract/plan.md`
> Research: `context/changes/workout-ui-contract/research.md`

## What & Why

Make the `/workout` page use the repo's design tokens and shared styles the same way the dashboard now does. The audit found white text on the danger colour that is hard to read in dark mode (2.65:1), shared buttons and selects parked in a page stylesheet without hover, focus or disabled states, a blank page while loading, and unannounced load errors.

## Starting Point

The dashboard change (PR #50) added `--on-accent`, `--radius`, `--ring`, `.card`, `.skeleton`, `.visually-hidden`, a screenshot spec and the `check:tokens` guard. `workout.css` was left out: it has one `#fff`, 9 radius literals, and defines `.btn-danger` and `.workout-select`, which `/plans`, `/exercises` and `/history/:id` also use.

## Desired End State

`/workout` reads every colour and radius from tokens in both themes. Danger buttons are readable in dark mode, delete buttons and selects look the same everywhere with proper hover, focus and disabled states, loading shows a skeleton card, and a Playwright spec plus an extended guard keep it that way.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Danger text colour | New `--on-danger` token (white light, `#16171d` dark) | Mirrors `--on-accent`; keeps the role explicit | Plan |
| Shared styles | Move `.btn-danger` and `.workout-select` to `page.css` | One home for shared primitives; stops views depending on `workout.css` | Plan |
| Page loading | Neutral skeleton card + hidden status text, new key `workout.loading` | Reuses dashboard skeleton; no blank page | Plan |
| Walkthrough rows | Add hover and `--ring` focus-visible, no layout change | Keyboard users need a visible focus | Research |
| Scope | One view per change; `/plans`, `/exercises` get their own | Keeps each audit and screenshot gate small | Research |
| Baselines | Windows locally, Linux from the CI runner's own images | Same approach that fixed CI for the dashboard | Plan |

## Scope

**In scope:** `workout.css` literals, `--on-danger`, moved shared styles with states, skeleton, `role="alert"`, walkthrough states, `.card`/`.visually-hidden`/`.pr-badge` reuse, new spec, guard coverage, `CLAUDE.md` line.

**Out of scope:** `/plans` and `/exercises` redesign, other stylesheets' radius literals, `topbar.css`, dark-mode toggle, new dependencies, API or logic changes.

## Architecture / Approach

Four phases in the `/10x-ui` order: tokens, shared states, the one view, then states + gate + guard. Everything stays plain CSS variables; the dark theme works through `:root` overrides.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Token values | `--on-danger`, no literals left in `workout.css` | Small radius change (6px to 8px) on one list |
| 2. Shared button and select states | `.btn-danger` / `.workout-select` in `page.css` with states | Slight visual change on 3 sibling views |
| 3. Workout view | Skeleton, `role="alert"`, walkthrough hover/focus, reused `.card` etc. | Skeleton cannot match both start and session layouts exactly |
| 4. 7-state spec, guard, rule | `workout-ui.spec.ts`, 4 baselines, extended `check:tokens`, `CLAUDE.md` | Seeding a plan session in the spec; baselines per OS |

**Prerequisites & estimated effort:** none beyond a running Postgres/backend for e2e. About the size of the dashboard change (4 small commits).

## References

- Full plan: `context/changes/workout-ui-contract/plan.md`
- Research: `context/changes/workout-ui-contract/research.md`
- Previous change: `context/changes/dashboard-ui-contract/plan.md`
