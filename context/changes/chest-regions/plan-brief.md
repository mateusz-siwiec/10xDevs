# Upper, Mid and Lower Chest — Plan Brief

> Full plan: `context/changes/chest-regions/plan.md`

## What & Why

Split the single `CHEST` muscle group into upper, mid and lower chest so incline, flat and decline work can be told apart in exercise tags, the body figure and the muscle stats. Today every press is just "Chest", so an incline press looks identical to a decline press.

## Starting Point

`CHEST` is one enum value, one pair of paths on the front figure and four seeded primaries plus one secondary. The shoulders split (V12) already proved the pattern: leaf groups in the enum, a Flyway migration rewriting strings, and parent rows computed only in the frontend.

## Desired End State

Three chest options appear in the exercise form and filter. The tooltip figure lights exactly one band per side for each region. The stats page shows a "Chest" parent row that sums three child rows. Existing custom exercises keep working and no `CHEST` value remains in the database.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Enum shape | Replace `CHEST` with three leaves; "Chest" is a frontend parent only | Mirrors the V12 shoulders split, so stats and filters keep one leaf model. |
| Custom exercises | All custom `CHEST` primaries and secondaries become `MID_CHEST` | Deterministic and lossless on set counts; no fragile name guessing. |
| Figure artwork | Cut the existing chest path into bands with a throwaway script, approved by preview | Keeps the licensed geometry and silhouette, no new dependency. |
| Seeded exercises | Incline dumbbell press to upper, bench press, chest fly, push-up, close-grip secondary to mid; add decline bench press and chest dip as lower | Every region has at least one catalogue exercise. |
| New content | Names plus four-line technique cues in English and Polish | Matches every other seeded slug. |
| Pickers | Flat list with three entries, no grouping | Zero new UI, inherits existing states and token rules. |
| Verification | Preview approval, unit and e2e selectors, no new screenshot baselines | Matches the earlier figure work and the baseline-refresh rule. |
| Constants timing | `MUSCLE_GROUPS` and `MUSCLE_PARENTS` change in Phase 2 with the figure | The figure test iterates `MUSCLE_GROUPS`, so both must change together. |

## Scope

**In scope:** enum and V14 migration; two new catalogue exercises; figure paths; frontend constants, labels, names and cues; unit and e2e test updates; `CLAUDE.md` note.

**Out of scope:** secondary chest regions on seeded presses; backend "Chest" total; grouped pickers; new screenshot baselines; other figure regions; `exercise-form-demos` work.

## Architecture / Approach

Backend first: enum plus V14 (primaries converted before secondaries, by-slug incline update before the blanket rule), tests proving it on legacy data. Then the figure and TypeScript constants together, gated on your preview approval. Then labels, new exercise content and the e2e updates, then docs and the full suites. Phases 1 to 3 merge as one branch because the frontend would send `CHEST` against the new backend otherwise.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend model and V14 migration | Enum split, data rewrite, 2 new exercises, backend tests | Migration ordering and the tests that still assume `CHEST`. |
| 2. Figure artwork with preview gate | Approved three-band chest paths plus matching constants | Geometric cuts may not look anatomical; needs your approval. |
| 3. Frontend integration | Labels, names and cues in en and pl, test updates | Many e2e specs touch `CHEST` as test data. |
| 4. Docs and full suites | `CLAUDE.md` update, all suites green, baselines untouched | A suite failure late in the branch. |

**Prerequisites:** local Postgres via `podman-compose up -d`; Docker for Testcontainers; the `@musclemap/assets` 1.1.0 data is already vendored in `muscleFigureData.ts`.
**Estimated effort:** about 3 to 4 sessions across 4 phases.

## Open Risks & Assumptions

- Evenly cut bands may look arbitrary on the figure; boundaries are adjustable after the preview.
- Existing custom incline or decline exercises show as Mid chest until their owners edit them.
- `GET /api/exercises?muscleGroup=CHEST` becomes a 400; I found no client other than the frontend filter.
- The untracked `exercise-form-demos` change lists catalogue slugs; it may need to know about the two new exercises.

## Success Criteria (Summary)

- Each of the three chest regions can be set on an exercise and shows up as its own band on the figure and its own row on the stats page.
- Existing data migrates without loss and no `CHEST` value remains.
- Backend, frontend and e2e suites pass and no existing screenshot baseline changed.
