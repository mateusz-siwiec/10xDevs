# Review follow-ups: extend-muscle-groups

## Plan addendum (F3)

Phase 4 "Labels" planned an extra accessible label for the stats toggle ("Show {{name}} details"). It was deliberately not added: the toggle button uses the visible parent name as its accessible name and exposes its state with `aria-expanded`/`aria-controls`, which keeps the accessible name equal to the visible text. The e2e spec relies on the plain parent name.

## Release note (F6)

`V12__split_shoulders_add_adductors_abductors.sql` is lossy for custom exercises: a custom primary "Shoulders" becomes "Side delts" and a custom secondary "Shoulders" becomes "Front delts", so historical set counts of such exercises move to "Side delts". Flyway applies it to the Supabase database at the next deploy. Back up the `exercises` and `exercise_secondary_muscle_groups` tables first and mention this in the PR description.
