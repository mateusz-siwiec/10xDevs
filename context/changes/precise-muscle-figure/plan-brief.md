# More precise body figure for the muscle map — Plan Brief

> Full plan: `context/changes/precise-muscle-figure/plan.md`

## What & Why

The muscle map's body figure is low-poly: angular, with no hands or feet. This swaps it for a much more anatomically precise figure (smooth outline, hands, feet, finely segmented muscles) that the user approved from a preview. The tooltip behaviour and highlighting stay the same; only the drawing changes.

## Starting Point

`MuscleMap` draws 66 polygons vendored from react-body-highlighter (`muscleRegions.ts`), shown in the technique tooltip, and the e2e specs select by `data-muscle` / `data-state`, not by shape. The app has no code-splitting (one 823 KB bundle, 244 KB gzipped), and the unit tests render synchronously with `renderToStaticMarkup`.

## Desired End State

Every exercise's panel shows the precise figure in light and dark, in pl and en. The figure ships as its own lazily loaded chunk, so the main bundle does not grow, and a failed load still leaves a working panel.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Figure source | Vendored paths from `@musclemap/assets` 1.1.0 (MIT), male front/back; no npm dependency, no `.webp` | Precise anatomy with an open licence, previewed and approved by the user | Plan |
| Group mapping | Trapezius + rhomboids -> TRAPS, latissimus -> LATS, three shoulder heads -> SHOULDERS, core -> ABS; adductors/abductors drawn as plain body | Maps cleanly onto our 14 groups without changing the data model | Plan |
| Loading | Lazy chunk (React.lazy) with a fixed-size placeholder | Adds nothing to the initial 244 KB gzipped bundle | Plan |
| Failure handling | Local error boundary, legend kept | A stale chunk after a deploy must not blank the page | Plan |
| Data size | Round coordinates to integers (88 KB raw / 33 KB gzipped) | About 30% smaller with no visible effect at about 8rem | Plan |
| Structure | `muscleFigureData.ts` + plain `MuscleFigure` + wrapper `MuscleMap` | Tests can render the renderer synchronously | Plan |
| Testing | Updated unit tests + existing Playwright specs + a blocked-chunk spec, no new baselines | Covers mapping, states and the failure path without platform-specific images | Plan |

## Scope

**In scope:** vendored data module, `MuscleFigure` renderer, lazy `MuscleMap` wrapper with placeholder and error boundary, `page.css` update, licence notice, unit and e2e tests, bundle check, removal of the old polygon data and of the temporary preview files.

**Out of scope:** female figure or toggle, new muscle groups, shoulder-head highlighting, API/DB changes, npm packages, new screenshot baselines, preloading, lazy loading elsewhere.

## Architecture / Approach

`MuscleMap` stays the public component (aria-label, legend). It lazy-loads `MuscleFigure`, which draws the two figures from the data module, behind Suspense and a small error boundary. The data is parsed as text from the package's constant arrays, de-duplicated, integer-rounded, and given one crop box computed from both outlines.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and renderer | `muscleFigureData.ts`, `MuscleFigure`, unit tests, licence notice (new files only) | Mapping or cropping mistakes (clipped hands/feet) |
| 2. Wire in | Lazy `MuscleMap`, placeholder, error boundary, CSS, old data deleted | Panel size jump when the figure appears; viewport clamping |
| 3. Playwright and verification | Blocked-chunk spec, existing specs green, bundle check, cleanup, full sweep | Async loading making existing specs flaky |

**Prerequisites:** the temporary preview files (untracked in `frontend/`) are the visual reference; Postgres and local servers for e2e.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- The package is early alpha and the figure is third-party data; the MIT notice must stay in the repo.
- The first panel open shows a brief placeholder while the chunk loads.
- Assumes the e2e specs keep working unchanged because they select by attributes; the Playwright dev server serves the figure as a separate module that can be blocked by route.
- Integer rounding is assumed visually safe at the display size; it is checked in Phase 1.

## Success Criteria (Summary)

- Every exercise shows the precise figure with correct highlighting in light and dark, pl and en, and for custom exercises.
- The main bundle does not grow (the figure is a separate chunk) and a blocked chunk leaves a working panel.
- Backend, unit, Playwright, build, lint and `check:tokens` all pass; Linux CI is green.
