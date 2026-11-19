---
date: 2026-11-18T14:50:48+01:00
researcher: Mateusz
git_commit: 34b1e70e7dd17b9fb3fc6223e3c1b2c5f89fc410
branch: main
repository: 10xDevs
topic: "Best source and implementation approach for small exercise-form movement demos in the TechniqueTooltip panel"
tags: [research, codebase, TechniqueTooltip, MuscleMap, MuscleFigure, exercise-catalog, free-exercise-db]
status: partial
last_updated: 2026-11-18
last_updated_by: Mateusz
---

# Research: movement demos for exercise form in the technique tooltip

**Date**: 2026-11-18T14:50:48+01:00
**Researcher**: Mateusz
**Git Commit**: 34b1e70e7dd17b9fb3fc6223e3c1b2c5f89fc410
**Branch**: main
**Repository**: 10xDevs

## Research Question

Which source and implementation approach fit small "how to perform this exercise" movement demos in the GymTrack `TechniqueTooltip` panel, next to the existing `MuscleMap`/`MuscleFigure`? Covered: (1) how the seeded catalog maps to candidate sources, (2) source licences and coverage, (3) where a per-slug demo plugs into the current code, (4) `CLAUDE.md` and test constraints, (5) a recommendation with trade-offs.

## Summary

- **The body figure cannot show movement.** `MuscleFigure` renders a fixed silhouette with one path per muscle region and no joints (`frontend/src/components/MuscleFigure.tsx:24-37`). It can show which muscles work, not how the limbs move. A demo needs a separate asset.
- **The catalog is 48 seeded exercises** on a fresh database with no custom rows. Each has a hand-written kebab-case slug (`V2__create_exercises_and_seed.sql:15-54`, `V12__split_shoulders_add_adductors_abductors.sql:9-17`; count asserted at `ExerciseSeedTest.java:36-40`). Custom exercises get `custom-<uuid>` slugs (`Exercise.java:48-49`), so a slug-keyed demo never matches them. There is no equipment column.
- **free-exercise-db is the simplest external source.** It is under The Unlicense, and its `dist/exercises.json` has 876 entries, 873 of them with 2 images (checked 2026-11-18). Each image is a JPG of about 38 KB in the one folder sampled. Its README does not state where the photos came from, so image provenance is unverified.
- **Only a minority of our 48 map cleanly by name.** Against that dataset, 13 of our 48 names match an entry exactly after lower-casing and stripping punctuation, 24 have one or more near-name candidates that need a human to pick, and 11 have no candidate (name matching only, so the numbers are a floor on what a human could match). Whether a candidate shows the same movement variant as ours is not checked.
- **The plug-in point is clear.** The panel body is head, muscle map, cues (`TechniqueTooltip.tsx:176-214`). A lazy-loaded demo section fits between the map and the cues, reusing the `MuscleMap` lazy pattern (`MuscleMap.tsx:5`, `:18-28`, `:49-53`).
- **Introducing media reverses an earlier scope decision.** The tooltip change listed "no images/videos" as out of scope (`context/changes/exercise-technique-tooltips/plan.md:34`), so this needs an explicit new decision.

Status is `partial`: no demo asset was viewed, no build or test was run, and several sources were not checked (see Open Questions).

## Detailed Findings

### Seeded catalog and slugs

- On a fresh database, V2 inserts 40 exercises and V12 adds 8, so 48 seeded rows exist after all migrations. The inspected migrations V3, V10 and V12 only delete secondary-group rows or update primary groups, and none deletes from `exercises` (V3, V10 and V12 only; V4-V7, V9, V11 and V13 were not opened by the worker). The count is also asserted by `ExerciseSeedTest.java:36-40`.
- `slug` is `varchar(255) not null unique` (`V2:3`). Seeded slugs are literals such as `barbell-bench-press`.
- The API exposes `id, slug, name, primaryMuscleGroup, secondaryMuscleGroups, custom, favorite` (`ExerciseResponse.java:104-112`). No equipment field exists anywhere in `src/main` or `src/test` (grep by the worker, which found nothing).
- Seeded slug groups that matter for demo difficulty: machine and cable exercises (for example `hip-adduction-machine`, `hip-abduction-machine`, `reverse-pec-deck`, `cable-crunch`), bodyweight exercises (`push-up`, `plank`, `copenhagen-plank`), and barbell lifts. Source: the catalog table in the worker report, derived by replaying V2, V3, V10, V12.

### Mapping the 48 slugs to free-exercise-db (name matching, checked 2026-11-18)

- **Exact (13 of 48):** incline-dumbbell-press, face-pull, barbell-curl, preacher-curl, triceps-pushdown, leg-press, romanian-deadlift, good-morning, seated-leg-curl, seated-calf-raise, plank, hanging-leg-raise, cable-crunch.
- **No candidate (11 of 48):** chest-fly, back-squat, bulgarian-split-squat, leg-press-calf-raise, ab-wheel-rollout, hip-adduction-machine, copenhagen-plank, hip-abduction-machine, banded-lateral-walk, reverse-pec-deck, bent-over-rear-delt-fly.
- **Candidates needing a human pick (24 of 48):** for example `overhead-press` has only "Smith Machine Overhead Shoulder Press" as a name candidate, and `push-up` has only variants such as "Decline Push-Up". Others like `deadlift` have several ("Barbell Deadlift", "Axle Deadlift", ...).
- The match was a normalised-name script over `dist/exercises.json`; it does not compare movement or equipment. Names like "Lying Leg Curls" were counted as candidates, not exact. Treat the exact count as a lower bound and the "no candidate" count as an upper bound for manual review (some may exist under other names, such as "Chest Fly" under "Dumbbell Flyes").

### Candidate sources and licences

| Source | Licence (as stated by the source) | Coverage checked | Asset | Obligations |
|---|---|---|---|---|
| free-exercise-db (yuhonas) | "The Unlicense" (GitHub repo API and README badge) | 876 entries, 873 with 2 images (own count, 2026-11-18) | JPG, `<id>/0.jpg` and `1.jpg`; about 38 KB each in one sampled folder | None legally for the Unlicense; README states no photo source, so provenance is unverified; credit the dataset anyway |
| wger | Per-entry "Creative Commons (see individual entries)" (README) | 394 images via `/api/v2/exerciseimage/` (worker count) | PNG | Per-image attribution and possibly share-alike; the licence-ID mapping was not verified |
| ExerciseDB | Code is AGPL-3.0; media terms not read | README claims 11,000+ exercises, 5,000+ GIFs | GIF and video | Treat as restricted or paid until terms are read |
| Own stick-figure SVG or own clips | Yours | 0 today | SVG or WebM | Authoring cost for each of 48 exercises |

- free-exercise-db images are plain start/end photos by naming (0 and 1); I did not open an image to confirm that 0 is the start and 1 is the end.
- The README suggests prefixing image paths with `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/` for hosting (README line 48). A HEAD request on one image returned HTTP 200 with `cache-control: max-age=300`, so it is not a long-cache CDN. Vendoring a subset is safer than hotlinking.
- Not checked: Wikimedia Commons illustrations, CC0 animation sets, open Lottie or stick-figure libraries.

### Where a demo plugs into the UI

- `TechniqueTooltip` returns `null` only when there are no cues and no primary muscle group (`TechniqueTooltip.tsx:91-92`). A custom exercise (slug `custom-<uuid>`) has no cues but still gets a panel with the muscle map when it has a primary group (`:146-150`, `:176-214`). A demo section for custom exercises must therefore be skipped explicitly.
- Panel order is head, muscle map, cues (`:176-214`). A demo section fits after the map.
- The map is lazy-loaded behind an error boundary and a skeleton sized to the figure's aspect ratio so the panel does not jump (`MuscleMap.tsx:5`, `:8-15`, `:18-28`, `:49-53`; `page.css:411-414`). A demo should reuse this pattern, with a placeholder of fixed size.
- Desktop positioning measures the panel once on open and on resize (`TechniqueTooltip.tsx:69-89`). An image that loads late and changes the panel size would not be re-measured, so reserve the demo's size in CSS.
- Phone layout is a bottom sheet with scroll lock (`:54-65`; `page.css:357-374`). A demo adds height there; the sheet scrolls (`max-height: calc(100dvh - 2rem)`), so it is safe but heavier on small screens.
- Technique cues live under `exerciseTechnique.<slug>` in `en.json:412` and `pl.json:430`, 48 slugs each. `locales.test.ts:84-91` forbids a key in `exerciseTechnique` that is not a seeded slug, so demo metadata must not be added there. A new namespace such as `exerciseDemo.<slug>` for alt text is allowed but must keep en/pl key parity (`locales.test.ts:26-35`).
- Frontend assets: `frontend/public/` has icons and the manifest only, with no exercise media (listing by the worker). The frontend deploys from Netlify (`netlify.toml`), with the API on Fly.io. Vite uses default settings with the React plugin only, so files under `public/` are copied as-is and a dynamic `import()` becomes its own chunk.

### Constraints from `CLAUDE.md`, tests and earlier changes

- **Tokens:** `npm run check:tokens` scans an explicit list of 20 files (`frontend/scripts/check-hardcoded-values.mjs:10-31`) and rejects hex colours, colour functions, arbitrary values and Tailwind palette classes. A new demo component and any new CSS file must be added to that list to be guarded. Inline SVG in guarded files must use `currentColor` or `var(--...)`.
- **Interactive controls:** `CLAUDE.md` requires hover, focus-visible and disabled states on any new control, so a pause or replay button needs all three.
- **Motion:** the repo has one keyframe animation (`skeleton-pulse`, `page.css:512-519`) disabled under `prefers-reduced-motion: reduce` (`page.css:525`), and a chevron transition under `no-preference` (`muscle-groups.css:62`). No looping content animation exists yet. Either convention works; a demo must have a reduced-motion variant.
- **Visual baselines:** only `dashboard-ui.spec.ts` and `workout-ui.spec.ts` take screenshots, both with `animations: 'disabled'` (`workout-ui.spec.ts:96-102`). I found no tooltip or map reference in them and the panel renders only when open, so the baselines probably do not include it. PNGs were not inspected. `CLAUDE.md` says baselines must not be refreshed without an explained delta.
- **Functional specs on the panel:** `technique-tooltip.spec.ts`, `muscle-map.spec.ts`, and the technique block in `exercises-list.spec.ts` (`:291-330`, `:443`). `muscle-map.spec.ts:93` aborts requests matching `**/MuscleFigure*` to test a failed chunk, so a demo chunk should not match that glob. Specs also assert custom exercises show no `.technique-list` (`muscle-map.spec.ts:111-127`).
- **Bundle gate precedent:** the muscle-figure change allowed at most 1 KB gzipped growth in the main bundle and moved about 33 KB gzipped into a separate chunk (`context/changes/precise-muscle-figure/plan.md:196`). Images under `public/` do not count towards the JS bundle but do count towards page weight when the panel opens.
- **Third-party notices:** vendored material is credited in `THIRD_PARTY_NOTICES.md` (root, per the worker). Any vendored images need a section there.
- **Scope history:** `context/changes/exercise-technique-tooltips/plan.md:34` listed "no images/videos" as out of scope and `:36` forbids refreshing baselines without an explained delta. A demo therefore needs this new change and an explicit decision to lift that scope line.

## Code References

- `frontend/src/components/TechniqueTooltip.tsx:91-92` - render guard (no cues and no primary group returns null)
- `frontend/src/components/TechniqueTooltip.tsx:176-214` - panel structure: head, muscle map, cues
- `frontend/src/components/TechniqueTooltip.tsx:69-89` - one-shot desktop positioning (needs reserved demo size)
- `frontend/src/components/MuscleMap.tsx:5,8-15,18-28,49-53` - lazy import, skeleton, error boundary, Suspense
- `frontend/src/components/MuscleFigure.tsx:24-37` - static front/back SVGs, no joints
- `frontend/src/utils/exercises.ts:16-33` - `exerciseName` and `exerciseTechnique` slug lookups
- `frontend/src/i18n/locales.test.ts:26-35,66-91` - parity, cue-count and no-orphan constraints
- `frontend/src/styles/page.css:274-470,512-525,612-680` - tooltip, panel, map, skeleton and motion CSS
- `frontend/scripts/check-hardcoded-values.mjs:10-31` - explicit file list for the token guard
- `src/main/java/com/example/gymtrack/exercise/ExerciseResponse.java:104-112` - fields exposed to the frontend
- `src/main/resources/db/migration/V2__create_exercises_and_seed.sql:15-54` and `V12__split_shoulders_add_adductors_abductors.sql:9-17` - the 48 seeded slugs

## Architecture Insights

- **Slug is the join key everywhere.** Names and cues are already resolved per slug in i18n, so a demo manifest keyed by slug (a frontend file, no backend or API change) matches the existing convention and needs no migration. It also means custom exercises fall back naturally.
- **Failure must degrade to today's panel.** The map's error boundary renders nothing on a failed chunk and the panel still works; the demo should do the same, so a missing image or chunk never breaks the cues.
- **Do not put demo metadata in `exerciseTechnique`.** The orphan test is tied to that namespace and to seeded slugs.

## Historical Context (from prior changes)

- `context/changes/exercise-technique-tooltips/plan.md:34` - media was explicitly out of scope: **superseded** by this change if the user approves it.
- `context/changes/exercise-technique-tooltips/plan.md:36` - baselines must not be refreshed without an explained delta: **still holds**.
- `context/changes/precise-muscle-figure/plan.md:196` - the 1 KB gzipped main-bundle gate and lazy chunk: **still a useful precedent**, partly applicable (images are not JS).
- `context/changes/precise-muscle-figure/change.md` - its `.webp` renders were ignored to keep size down (per the worker; not re-read here): **partially supported**, not rechecked.
- Not read: `exercise-technique-tooltips/reviews/`, both `plan-brief.md` files, `muscular-failure-tracking`, `context/foundation/` for media or licensing constraints.

## Related Research

None under `context/changes/**/research.md` or `context/archive/**/research.md` was found on this topic (search limited to the change folders listed by `ls context/changes`).

## Recommendation (for planning, not a decision)

1. **Preferred: vendor a curated subset of free-exercise-db as two-frame crossfade demos.** Hand-pick the entry for each of our 48 slugs, copy `0.jpg` and `1.jpg` into `frontend/public/` (or downscale to WebP), and key a small manifest by slug. Crossfade with CSS under `prefers-reduced-motion: no-preference`; show the two frames side by side under `reduce`. Expected weight is roughly 76 KB per exercise at the sampled size, about 3.6 MB for 48 exercises unless downscaled, loaded only when a panel opens.
   - **Trade-off:** coverage is partial. At most 37 of our 48 have any name candidate, and only a human review can say how many show the right movement. The 11 without a candidate fall back to today's panel.
   - **Risk:** image provenance is unstated in the README. Record the credit in `THIRD_PARTY_NOTICES.md` and decide whether that residual risk is acceptable.
2. **Fallback for gaps: your own stick-figure SVG** for the exercises with no candidate (hip adduction/abduction machines, copenhagen plank, banded lateral walk and similar). Authoring cost is per exercise; consider doing it only for the 11 uncovered slugs.
3. **Not recommended now:** wger (per-image licence obligations), ExerciseDB (media terms unverified), and the muscle-pulse CSS-only idea as a *form* demo, since it shows where, not how. The pulse could still ship cheaply as a separate, optional enhancement.

## Open Questions

- Does the user accept free-exercise-db's unstated photo provenance, and is a visible credit enough?
- Which free-exercise-db entry should represent each of the 24 candidate slugs, and does it show the same variant (for example barbell vs Smith machine for `overhead-press`)? Needs a human with lifting knowledge, and also covers the content-accuracy concern that a poor demo is worse than none.
- Are the images in each folder really start (0) and end (1) positions? Not opened.
- Image dimensions and total weight after downscaling. Not measured.
- Do `exercises-list.spec.ts` or any e2e spec screenshot the open panel? Grep-level only; baselines not viewed.
- Unchecked sources: Wikimedia Commons, CC0 animation sets, open Lottie or stick-figure libraries, ExerciseDB terms, wger licence-ID mapping.
- Whether the PWA manifest comes with a service worker or precache list that would pick up new `public/` assets. Not checked.
- Not run: `npm run build`, `check:tokens`, vitest, Playwright.
