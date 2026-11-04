---
change_id: exercise-muscle-maps
title: Muscle maps and finer back muscle groups
status: implementing
created: 2026-11-03
updated: 2026-11-04
archived_at: null
---

## Notes

Muscle activation maps for exercises (built-in and custom), shown as a front/back body SVG inside the technique tooltip, coloured via design tokens from primaryMuscleGroup / secondaryMuscleGroups (no slug mapping, no per-exercise image files). To make it detailed, BACK is split into LATS, TRAPS, LOWER_BACK and FOREARMS is added (13 groups) via a new V10 migration: built-ins remapped by slug, custom BACK exercises default to LATS. Substitutes and stats follow the finer groups. Custom exercises get a map-only tooltip. Needs backend and unit tests, token-compliant styling (npm run check:tokens), and Playwright coverage.

Future ideas (out of scope here): split BICEPS into short/long head and TRICEPS into long/lateral/medial head (new groups + migration, same pattern as the BACK/CORE split); add built-in exercises for TRAPS, LOWER_BACK, FOREARMS and OBLIQUES, which currently have no primary built-ins.

Phase 3 deviation (approved 2026-11-04): after two hand-drawn attempts looked unnatural (overlapping muscle outlines, poor hands), the figure was replaced by polygons vendored from react-body-highlighter 2.0.5 (MIT, copyright GV79) in `frontend/src/components/muscleRegions.ts`, mapped to the 14 groups; licence text in `THIRD_PARTY_NOTICES.md`. No npm dependency was added.
