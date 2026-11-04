# More precise body figure for the muscle map Implementation Plan

## Overview

Replace the low-poly body figure behind `MuscleMap` with the much more anatomically precise, traced paths from `@musclemap/assets` 1.1.0 (MIT, Jsplice / MuscleMap): a smooth male front and back outline with hands and feet, plus finely segmented muscle paths. The paths are vendored (no npm dependency; the package's raster `.webp` renders are ignored), rounded to integers, mapped to our 14 muscle groups, and loaded lazily in their own chunk behind a placeholder and an error boundary. The tooltip, token styling and `data-muscle` / `data-state` attributes stay as they are, and `THIRD_PARTY_NOTICES.md` is updated to credit the new source.

## Current State Analysis

- The figure is drawn by `frontend/src/components/MuscleMap.tsx` from `MUSCLE_REGIONS` in `frontend/src/components/muscleRegions.ts` (66 low-poly polygons vendored from react-body-highlighter, viewBox 0 0 100 200, no hands or feet). It renders two `<svg>` figures as `<polygon data-muscle data-state>` plus a legend, and sets `role="img"` with an aria-label on the wrapper.
- `MuscleMap` is rendered in one place: `TechniqueTooltip.tsx:166`. Styles live in `frontend/src/styles/page.css:335-395` (`.muscle-map`, `.muscle-map-figures`, `.muscle-region[data-state=...]`, `.muscle-legend`, `.muscle-swatch--*`), tokens `--muscle-primary|secondary|idle` are in `index.css`, and `.skeleton` exists at `page.css:430`.
- Tests: `MuscleMap.test.tsx` renders with `renderToStaticMarkup` (no DOM, no `@testing-library`) and regex-matches `<polygon ... data-muscle ... data-state>`. e2e specs (`muscle-map.spec.ts`, `technique-tooltip.spec.ts`, `exercises-list.spec.ts`) select by `[data-muscle=...][data-state=...]`, not by element type. `scripts/check-hardcoded-values.mjs:28` scans `MuscleMap.tsx`.
- The app has no code-splitting at all: one bundle of 823 KB (244 KB gzipped), no `lazy()` / dynamic `import()` anywhere. No `lessons.md` exists.
- The candidate data (inspected in an isolated scratch directory, files contain only constant arrays): per view one `BODY` outline path and 28 (front) / 30 (back) muscle paths in viewBox 0 0 1024 1536, each with a group (TRAPEZIUS, RHOMBOIDS, LATS, BACK_LOWER, SHOULDERS_FRONT/SIDE/REAR, CHEST, BICEPS, TRICEPS, FOREARMS, CORE, OBLIQUES, QUADS, CALVES, GLUTES, HAMSTRINGS, ABDUCTORS, ADDUCTORS). Measured: 126 KB raw / 48 KB gzipped as is; 88 KB raw / 33 KB gzipped rounded to integers.
- A preview of this data mapped to our groups was approved by the user (light and dark).
- `THIRD_PARTY_NOTICES.md` currently credits react-body-highlighter for `muscleRegions.ts`, which this change removes.

## Desired End State

Opening the info button on any exercise shows the new precise front and back figure with the exercise's primary muscles strong and secondary muscles light, in light and dark themes and in both languages. The figure's code is a separate chunk fetched the first time a panel opens; the main bundle does not grow, and a failed chunk load leaves a working panel (legend and, for built-ins, the cues) instead of a blank screen. Verified by unit tests, Playwright specs, a bundle check, lint, build and `check:tokens`.

### Key Discoveries:

- Only `muscleRegions.ts` and `MuscleMap.tsx` know the figure's shape; the tooltip and e2e specs depend on attributes only (`TechniqueTooltip.tsx:166`, `e2e/muscle-map.spec.ts:50-74`).
- `renderToStaticMarkup` cannot render a lazy component, so the state logic must live in a plain renderer component that tests render directly.
- A rejected `React.lazy` import throws to the nearest error boundary, and the app has none; without a local boundary a stale chunk after a deploy could blank the page.
- Integer rounding cuts the data by about 30% with no visible effect at roughly 8rem wide.

## What We're NOT Doing

- A female figure or a male/female toggle (the package ships both; only the male figure is vendored).
- Splitting shoulders into three heads or any other change to the 14 muscle groups, the API, the database or the exercise form.
- Adding the `@musclemap/assets` or `@musclemap/react` npm packages, or using the raster `.webp` bodies.
- New Playwright screenshot baselines.
- Preloading or prefetching the chunk before a panel opens.
- Moving other parts of the app to lazy loading.

## Implementation Approach

Add the new data and a plain renderer first, with tests, as new files only, so nothing in the app changes until Phase 2. Phase 2 switches `MuscleMap` to load the renderer lazily behind Suspense, a fixed-size placeholder and an error boundary, restyles the figure for the new path-based drawing, and deletes the old polygon data. Phase 3 proves the behaviour end to end, including a blocked chunk, checks the bundle, and removes the temporary preview files.

## Critical Implementation Details

- **Timing & lifecycle** — The panel's viewport clamping measures the panel when it opens (`TechniqueTooltip.tsx`); the placeholder must reserve the same width and height as the figures so the panel does not change size when the chunk arrives. The error-boundary fallback should keep the legend visible.
- **Data provenance** — Extract the path data by text-parsing the package's `dist/male-front.js` and `dist/male-back.js` (constant arrays only; do not execute downloaded code). Keep the package's per-view `BODY` outline and muscle `d` strings, de-duplicate repeated paths (the back view lists trapezius twice), round all coordinates to integers, and compute one crop `viewBox` from the union bounding box of both outlines plus a small margin so hands and feet are never clipped.

## Phase 1: Data and renderer

### Overview

New files only: the vendored, mapped and rounded figure data, a plain renderer, unit tests, and the licence notice. No behaviour change in the app.

### Changes Required:

#### 1. Figure data

**File**: `frontend/src/components/muscleFigureData.ts` (new)

**Intent**: Hold the vendored figure for both views in a compact, typed form that maps every path to one of our `MuscleGroup` values.

**Contract**: header comment crediting `@musclemap/assets` 1.1.0 (MIT, Copyright (c) 2026 Jsplice / MuscleMap contributors) and pointing to `THIRD_PARTY_NOTICES.md`. Exports `MUSCLE_FIGURE_VIEW_BOX: string` (computed crop box), and `MUSCLE_FIGURE: Record<'front' | 'back', { body: string; muscles: { group: string | null; d: string }[] }>`. Mapping (source group -> our group): TRAPEZIUS and RHOMBOIDS -> `TRAPS`; LATS -> `LATS`; BACK_LOWER -> `LOWER_BACK`; SHOULDERS_FRONT, SHOULDERS_SIDE and SHOULDERS_REAR -> `SHOULDERS`; CORE -> `ABS`; CHEST -> `CHEST`; BICEPS -> `BICEPS`; TRICEPS -> `TRICEPS`; FOREARMS -> `FOREARMS`; OBLIQUES -> `OBLIQUES`; QUADS -> `QUADS`; CALVES -> `CALVES`; GLUTES -> `GLUTES`; HAMSTRINGS -> `HAMSTRINGS`; ABDUCTORS and ADDUCTORS -> `null` (plain body, never highlighted). Paths rounded to integers and de-duplicated. A one-off generator is not kept in the repo.

#### 2. Renderer

**File**: `frontend/src/components/MuscleFigure.tsx` (new)

**Intent**: Draw the two figures for a given primary and secondary muscle; pure and synchronous, so unit tests can render it directly.

**Contract**: `default function MuscleFigure({ primary, secondary }: { primary: string; secondary: string[] })`. Per view an `<svg viewBox={MUSCLE_FIGURE_VIEW_BOX} aria-hidden focusable="false" data-view="front|back">` containing the body outline `<path className="muscle-body">` first and then one `<path className="muscle-region" data-muscle data-state>` per muscle path. `data-state` is `primary`, `secondary` or `idle` for a mapped group; primary wins when a group is in both inputs; unknown strings highlight nothing; paths with `group: null` render with `data-state="body"` and no `data-muscle`.

#### 3. Unit tests

**File**: `frontend/src/components/MuscleFigure.test.tsx` (new)

**Intent**: Lock the data-to-paths mapping and the state logic (the old `MuscleMap.test.tsx` cases move here in Phase 2).

**Contract**: every value of `MUSCLE_GROUPS` owns at least one path in the data; a group drawn in both views is highlighted in both; primary / secondary / idle states; primary beats secondary; an unknown group highlights nothing; body-only paths carry `data-state="body"` and no `data-muscle`; the data contains no `null` muscle group other than ABDUCTORS/ADDUCTORS (sanity check of the mapping, e.g. no unmapped source group).

#### 4. Licence notice

**File**: `THIRD_PARTY_NOTICES.md`

**Intent**: Credit the new source as soon as its data enters the repo.

**Contract**: add a section for `@musclemap/assets` 1.1.0 (`https://github.com/Jsplice/MuscleMap`) covering `muscleFigureData.ts`, with the package's MIT licence text verbatim (including "Copyright (c) 2026 Jsplice / MuscleMap contributors"). Keep the existing react-body-highlighter section for now, because `muscleRegions.ts` still exists until Phase 2 removes it.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` (from `frontend/`)
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`
- Licence notice names the new source: `grep -ci "musclemap" ../THIRD_PARTY_NOTICES.md` is at least 1

#### Manual Verification:

- Skim the generated `muscleFigureData.ts` header and mapping against the plan table (group names, attribution, no executable code)
- Rendering `MuscleFigure` in the temporary preview shows both figures complete, with no clipped hands or feet, for several exercises (Barbell Row, Plank, Deadlift)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Wire in

### Overview

`MuscleMap` loads `MuscleFigure` lazily behind Suspense, a fixed-size placeholder and an error boundary; the styles are updated for the new drawing; the old polygon data is removed.

### Changes Required:

#### 1. MuscleMap

**File**: `frontend/src/components/MuscleMap.tsx`

**Intent**: Keep the aria-label and legend synchronous and load only the figure lazily.

**Contract**: props unchanged (`primary: string; secondary: string[]`). Wrapper `.muscle-map-figures` keeps `role="img"` and the `exercises.musclesLabel` aria-label. Inside it: a small local error boundary (class component) around `<Suspense fallback={<MuscleFigurePlaceholder />}>` around `const MuscleFigure = lazy(() => import('./MuscleFigure'))`. The placeholder is two `.skeleton`-styled blocks with the same width and aspect ratio as the real figures (derived from `MUSCLE_FIGURE_VIEW_BOX` is not allowed since that would import the data; use a fixed aspect in CSS). The boundary fallback renders nothing for the figures. The legend stays outside the boundary.

#### 2. Styling

**File**: `frontend/src/styles/page.css`

**Intent**: Style the path-based figure with tokens only and size it for the panel.

**Contract**: replace the `.muscle-region` rules (`page.css:350-362`) so that `.muscle-body` has `fill: var(--code-bg)` and a `var(--text)` stroke at reduced opacity, `.muscle-region` has `fill: var(--muscle-idle)` and a `var(--bg)` stroke, `[data-state='primary']` / `['secondary']` use the existing tokens, and `[data-state='body']` stays idle-looking. Stroke widths are in the new 1024-unit coordinate space. `.muscle-map-figures svg` width about 7.5rem with `height: auto`; add a placeholder class with the matching aspect ratio. No literal colours, radii or arbitrary values.

#### 3. Remove the old figure

**Files**: `frontend/src/components/muscleRegions.ts` (delete), `THIRD_PARTY_NOTICES.md`, `frontend/src/components/MuscleMap.test.tsx`, `frontend/scripts/check-hardcoded-values.mjs`

**Intent**: Leave a single source of truth for the figure and keep tests and the token guard accurate.

**Contract**: delete `muscleRegions.ts` and remove the react-body-highlighter section from `THIRD_PARTY_NOTICES.md` in the same change, so the notice never credits a file that no longer exists; `MuscleMap.test.tsx` keeps only the synchronous behaviour of the wrapper (the aria-label names the muscles in en and pl, the legend labels, and that the lazy figure is not in the initial static markup while the placeholder is) and drops the polygon-based state tests that now live in `MuscleFigure.test.tsx`; add `src/components/MuscleFigure.tsx` to the token guard's `FILES` list.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check and build pass: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values: `npm run check:tokens`
- No leftover reference to the old data: `grep -rn "muscleRegions\|react-body-highlighter" src ../THIRD_PARTY_NOTICES.md` returns nothing

#### Manual Verification:

- List, workout picker and substitutes panel show the new figure for a built-in exercise (Barbell Row: lats strong; traps, biceps, forearms light) and a map-only panel for a custom exercise
- The panel does not visibly jump in size when the figure appears, and it stays inside the viewport on a 390px-wide screen
- Light and dark themes look right; Polish and English legends are correct
- All 14 groups highlight the expected area (checked in the temporary preview grid)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Playwright and verification

### Overview

Prove the lazy figure and its failure path end to end, keep the existing specs green, verify the bundle effect, and clean up the temporary preview files.

### Changes Required:

#### 1. Blocked-chunk spec

**File**: `frontend/e2e/muscle-map.spec.ts`

**Intent**: Show that a failed figure load degrades gracefully.

**Contract**: add a test that aborts the request for the `MuscleFigure` module (route pattern matching `**/MuscleFigure*` in both dev and built output), opens a built-in exercise's panel in the exercises list, and asserts the panel still opens, the legend is visible, the technique cues are present, no `[data-muscle]` element exists, and the page did not crash (the exercises list is still visible). Existing assertions on `[data-muscle][data-state]` stay unchanged.

#### 2. Existing specs and bundle check

**Files**: `frontend/e2e/muscle-map.spec.ts`, `frontend/e2e/technique-tooltip.spec.ts`, `frontend/e2e/exercises-list.spec.ts`

**Intent**: Confirm the swap did not change observable behaviour.

**Contract**: run them unchanged first; touch a spec only if the async figure load requires an explicit wait (prefer Playwright auto-waiting over sleeps). No new screenshot baselines. `npm run build` must show the figure as its own JS chunk (a file containing `MuscleFigure`) and the main `index-*.js` gzipped size must not exceed the pre-change 244.01 KB by more than 1 KB.

#### 3. Cleanup

**Files**: `frontend/muscle-map-preview.html`, `frontend/src/muscle-map-preview.tsx`, `frontend/src/mm-preview-data.json`, `frontend/shot.tmp.mjs` (untracked, delete)

**Intent**: Leave no temporary preview artefacts.

**Contract**: remove the four files; `git status` shows none of them; stop the dev server used for previews.

### Success Criteria:

#### Automated Verification:

- Playwright suite passes (Postgres and servers available, `CI` unset): `npm run test:e2e` (from `frontend/`)
- Backend tests pass: `./mvnw test`
- Unit tests pass: `npm test`
- Build passes and emits a separate figure chunk with the main bundle not growing by more than 1 KB gzipped: `npm run build`
- Lint passes: `npm run lint`
- No hard-coded values: `npm run check:tokens`
- No preview leftovers: `git status --porcelain` lists none of the four temporary files

#### Manual Verification:

- Hover, keyboard focus and tap still open and close the panel as before
- With the network throttled the first panel open shows the placeholder briefly and then the figure; later opens are instant
- Linux CI passes, including the `workout-mobile-dark` baseline unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- `MuscleFigure.test.tsx`: every `MUSCLE_GROUPS` value has a path, both-view highlighting, states and precedence, unknown group, body-only paths.
- `MuscleMap.test.tsx`: aria-label in en and pl, legend labels, placeholder present in the initial static markup.

### Integration Tests:

- Playwright: existing `muscle-map`, `technique-tooltip` and `exercises-list` specs unchanged in intent, plus a blocked-chunk test.

### Manual Testing Steps:

1. Open the exercises list, hover the info button on Barbell Row, check the figure and states in light and dark.
2. Repeat in the workout picker area and the substitutes panel, and for a custom exercise.
3. Switch language; check a 390px viewport.
4. Throttle the network and watch the first open.

## Performance Considerations

About 33 KB gzipped of path data moves out of the main bundle into a chunk loaded on first panel open; later opens use the cached module. The figure is a few dozen static paths rendered only while a panel is open.

## Migration Notes

None. No schema, API or stored data changes. Rollback is reverting the commit (the old data comes back with it).

## References

- Prior change: `context/archive/2026-11-03-exercise-muscle-maps/plan.md`
- Current figure: `frontend/src/components/MuscleMap.tsx`, `frontend/src/components/muscleRegions.ts`, `frontend/src/styles/page.css:335-395`, `frontend/src/components/TechniqueTooltip.tsx:166`
- Tests that touch the figure: `frontend/src/components/MuscleMap.test.tsx`, `frontend/e2e/muscle-map.spec.ts:50-74`
- Source data: `@musclemap/assets` 1.1.0, `dist/male-front.js`, `dist/male-back.js` (https://github.com/Jsplice/MuscleMap, MIT)
- Token guard: `frontend/scripts/check-hardcoded-values.mjs:28`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data and renderer

#### Automated

- [x] 1.1 Unit tests pass: `npm test` (from `frontend/`) — 6f08d6b
- [x] 1.2 Type check and build pass: `npm run build` — 6f08d6b
- [x] 1.3 Lint passes: `npm run lint` — 6f08d6b
- [x] 1.4 Licence notice names the new source: `grep -ci "musclemap" ../THIRD_PARTY_NOTICES.md` is at least 1 — 6f08d6b

#### Manual

- [ ] 1.5 Generated `muscleFigureData.ts` header and mapping match the plan table (attribution, group names, no executable code)
- [x] 1.6 `MuscleFigure` renders both figures complete, with no clipped hands or feet, for Barbell Row, Plank and Deadlift — 6f08d6b

### Phase 2: Wire in

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — efdd78c
- [x] 2.2 Type check and build pass: `npm run build` — efdd78c
- [x] 2.3 Lint passes: `npm run lint` — efdd78c
- [x] 2.4 No hard-coded values: `npm run check:tokens` — efdd78c
- [x] 2.5 No leftover reference to the old data: `grep -rn "muscleRegions\|react-body-highlighter" src ../THIRD_PARTY_NOTICES.md` returns nothing — efdd78c

#### Manual

- [x] 2.6 List, workout picker and substitutes panel show the new figure for a built-in exercise, and a map-only panel for a custom one — efdd78c
- [x] 2.7 The panel does not visibly jump in size when the figure appears and stays inside the viewport on a 390px-wide screen — efdd78c
- [x] 2.8 Light and dark themes look right; Polish and English legends are correct — efdd78c
- [x] 2.9 All 14 groups highlight the expected area (temporary preview grid) — efdd78c

### Phase 3: Playwright and verification

#### Automated

- [x] 3.1 Playwright suite passes (Postgres and servers available, `CI` unset): `npm run test:e2e` — aa56f48
- [x] 3.2 Backend tests pass: `./mvnw test` — aa56f48
- [x] 3.3 Unit tests pass: `npm test` — aa56f48
- [x] 3.4 Build passes and emits a separate figure chunk with the main bundle not growing by more than 1 KB gzipped: `npm run build` — aa56f48
- [x] 3.5 Lint passes: `npm run lint` — aa56f48
- [x] 3.6 No hard-coded values: `npm run check:tokens` — aa56f48
- [x] 3.7 No preview leftovers: `git status --porcelain` lists none of the four temporary files — aa56f48

#### Manual

- [x] 3.8 Hover, keyboard focus and tap still open and close the panel as before — aa56f48
- [x] 3.9 With the network throttled the first open shows the placeholder briefly, then the figure; later opens are instant — aa56f48
- [ ] 3.10 Linux CI passes, including the `workout-mobile-dark` baseline unchanged
