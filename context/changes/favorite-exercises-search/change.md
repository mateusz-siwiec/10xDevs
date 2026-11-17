---
change_id: favorite-exercises-search
title: Favourite exercises and text search in exercise lists
status: implemented
created: 2026-11-16
updated: 2026-11-17
archived_at: null
---

## Notes

Add per-user favourite exercises (star toggle) and text search in the exercise lists: the Exercises page and the exercise picker (workout + plan editor). Favourites are listed first in the picker.

Decisions: scope = both lists; favourites are per user (table `favorite_exercises`, migration V11), working for catalog and custom exercises.

Already prototyped before planning (to be reviewed by the plan): migration V11, `FavoriteExercise` entity/repository, `favorite` field on `ExerciseResponse`, `PUT/DELETE /api/exercises/{id}/favorite`, tests in `ExerciseControllerTest`. Frontend not started.
