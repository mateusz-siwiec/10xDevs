---
change_id: chest-regions
title: Upper, mid and lower chest muscle groups
status: implementing
created: 2026-11-19
updated: 2026-11-19
archived_at: null
---

## Notes

Split the single CHEST muscle group into UPPER_CHEST, MID_CHEST and LOWER_CHEST, following the V12 shoulders split: the enum gets the three leaves and loses CHEST, "Chest" survives only as the frontend parent row in MUSCLE_PARENTS. Flyway V14 re-tags the seeded exercises by slug (incline-dumbbell-press to UPPER_CHEST; bench press, chest fly, push-up and the close-grip secondary to MID_CHEST), converts every custom CHEST primary/secondary to MID_CHEST, and adds decline-bench-press and chest-dip as LOWER_CHEST. The figure's chest path is cut into three bands per side with a throwaway script outside the repo, approved by preview before it is committed. Names and technique cues for the two new exercises are added in en and pl.
