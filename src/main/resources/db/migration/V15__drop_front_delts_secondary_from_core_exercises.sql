-- The shoulders split (V12) turned the generic SHOULDERS secondary of Plank and Ab Wheel Rollout into FRONT_DELTS.
-- Neither exercise trains the front delts enough to count as a secondary muscle, and the tag inflated the
-- secondary-muscle numbers on the sets-per-muscle-group page. Catalog exercises only (owner_id is null);
-- user-created exercises keep whatever their owner chose.
delete from exercise_secondary_muscle_groups
where muscle_group = 'FRONT_DELTS'
  and exercise_id in (
    select id from exercises
    where slug in ('plank', 'ab-wheel-rollout') and owner_id is null
  );
