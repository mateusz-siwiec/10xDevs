---
change_id: precise-muscle-figure
title: More precise body figure for the muscle map
status: implementing
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

Replace the low-poly react-body-highlighter body figure in MuscleMap with the much more anatomically precise paths from @musclemap/assets (MIT, Jsplice/MuscleMap): male front and back outline plus segmented muscle paths with hands and feet, mapped to our 14 muscle groups (TRAPEZIUS+RHOMBOIDS->TRAPS, LATISSIMUS->LATS, shoulder front/side/rear->SHOULDERS, CORE->ABS, adductors/abductors = plain body). Vendor only the SVG path data (no npm dependency, ignore the .webp renders), round coordinates and load the figure lazily to limit bundle size, update THIRD_PARTY_NOTICES.md, keep token styling, data-muscle/data-state attributes, and existing unit/e2e tests passing. Candidate preview was approved by the user.
