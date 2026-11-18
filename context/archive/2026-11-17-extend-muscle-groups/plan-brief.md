# Extend muscle groups (split deltoids, adductors, abductors) — Plan Brief

> Full plan: `context/changes/extend-muscle-groups/plan.md`

## What & Why

Split "Shoulders" into front, side (middle) and rear delts, and add adductors and hip abductors as muscle groups. Lifters train and track these separately, and today the catalogue, stats and body figure can't tell a lateral raise from a face pull or show inner-thigh work at all.

## Starting Point

Muscle groups are one backend enum mirrored in a frontend list, stored as plain strings, and shown on the stats page, exercise form, filters and a body figure. The figure was vendored from the MuscleMap package with all shoulder paths merged and adductors/abductors never highlighted. `V10` already did a similar split (`BACK`, `CORE`), so there is a pattern to follow.

## Desired End State

`SHOULDERS` is gone; five new groups exist (`FRONT_DELTS`, `SIDE_DELTS`, `REAR_DELTS`, `ADDUCTORS`, `ABDUCTORS`) across data, API, UI labels (EN/PL) and the figure. The muscle stats page keeps a short list of six parent rows (Chest, Back, Shoulders, Arms, Legs, Core) that expand to their sub-groups. Built-in exercises are retagged, eight new built-in exercises (48 total) make the new groups usable, and existing custom exercises survive with a sensible mapping.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Shoulders model | Replace with 3 groups | Same approach as V10 and no ambiguous umbrella group in stats or figure. | Plan |
| Custom exercises with Shoulders | Primary to `SIDE_DELTS`, secondary to `FRONT_DELTS` | Matches how "shoulders" is usually used (lateral work) and where it is secondary (presses). | Plan |
| Extra groups | Hip abductors (adductors' pair); rhomboids declined | Completes the inner/outer thigh pair at low cost; rhomboids would need larger back retagging. | Plan |
| Catalogue | Add 8 built-in exercises | Otherwise the new groups would have nothing to pick or highlight. | Plan |
| Migration number | `V12`, after PR #64 (`V11`) is merged | Keeps a linear Flyway history. | Plan |
| Stats page | Six collapsible parents (Chest, Back, Shoulders, Arms, Legs, Core), grouped and summed in the frontend | Matches the requested Shoulders/Back drill-down for every muscle without an API change; Forearms stays one group under Arms. | Plan |
| Figure data | Re-vendor from `@musclemap/assets@1.1.0` | Only the source has separate delt, adductor and abductor paths. | Plan |

## Scope

**In scope:** enum and `V12` data migration, 8 new exercises with EN/PL names and cues, retagging, frontend list and labels, figure re-split, tests, docs.

**Out of scope:** rhomboids, hip flexors, neck, tibialis, chest and triceps sub-heads, changing how stats count sets, redesign of any screen.

## Architecture / Approach

Backend first: enum plus one migration (retag, convert custom rows, insert catalogue), covered by seed tests and a migration-over-data test. Then the frontend list, labels and exercise content (the locale test reads the migrations, so order matters), then the figure regenerated from the MuscleMap source, then the collapsible stats page, then a pass over the remaining surfaces, plus docs and full suites.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend groups, migration, catalogue | Enum, `V12`, 8 exercises, updated tests | Data conversion of custom rows and hard-coded counts |
| 2. Frontend foundation | Group list, EN/PL labels, names and technique cues | Locale test requires cues for every new slug |
| 3. Body figure | Separate delt, adductor, abductor regions | Needs the npm package download (earlier attempt was denied) |
| 4. Collapsible muscle stats | Parent rows with expandable sub-groups | Accessible disclosure pattern, updating the existing stats spec |
| 5. Surfaces, docs, full suites | Verified form, filters, docs | 18 groups in layouts, unexpected baseline deltas |

**Prerequisites:** PR #64 (favourites, `V11`) merged to `main`; local Postgres running; permission to download the MuscleMap package into a scratch folder.
**Estimated effort:** ~4-5 sessions across 5 phases.

## Open Risks & Assumptions

- The custom-exercise conversion is lossy (all old Shoulders become side or front delts); a backup of the exercise tables is advised before the first production deploy.
- Per-view membership of MuscleMap surfaces was not verified; rear/side delt segments in the back view must be checked after extraction.
- Polish names for the new groups and exercises are my translation and may need your review.

## Success Criteria (Summary)

- All five new groups appear in the form, filters, stats (under collapsible parents) and figure, in EN and PL, and highlight correctly.
- No stored `SHOULDERS` remains and existing custom exercises still open and edit.
- Backend and full e2e suites pass with no baseline changes.
