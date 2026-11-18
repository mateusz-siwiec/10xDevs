-- Split SHOULDERS into FRONT_DELTS / SIDE_DELTS / REAR_DELTS and add ADDUCTORS / ABDUCTORS with new catalog exercises.

-- 1. Built-in primaries (by slug).
update exercises set primary_muscle_group = 'FRONT_DELTS' where slug in ('overhead-press', 'arnold-press');
update exercises set primary_muscle_group = 'SIDE_DELTS' where slug = 'lateral-raise';
update exercises set primary_muscle_group = 'REAR_DELTS' where slug = 'face-pull';

-- 2. New catalog exercises (owner_id stays NULL, id comes from the column default).
insert into exercises (slug, name, primary_muscle_group) values
    ('hip-adduction-machine', 'Hip Adduction Machine', 'ADDUCTORS'),
    ('copenhagen-plank', 'Copenhagen Plank', 'ADDUCTORS'),
    ('hip-abduction-machine', 'Hip Abduction Machine', 'ABDUCTORS'),
    ('banded-lateral-walk', 'Banded Lateral Walk', 'ABDUCTORS'),
    ('reverse-pec-deck', 'Reverse Pec Deck', 'REAR_DELTS'),
    ('bent-over-rear-delt-fly', 'Bent-Over Rear Delt Fly', 'REAR_DELTS'),
    ('front-raise', 'Front Raise', 'FRONT_DELTS'),
    ('cable-lateral-raise', 'Cable Lateral Raise', 'SIDE_DELTS');

-- 3. Built-in secondaries by slug (the stored SHOULDERS ones are replaced in step 4).
insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select e.id, s.muscle_group
from (values
    ('barbell-bench-press', 'FRONT_DELTS'),
    ('incline-dumbbell-press', 'FRONT_DELTS'),
    ('push-up', 'FRONT_DELTS'),
    ('close-grip-bench-press', 'FRONT_DELTS'),
    ('plank', 'FRONT_DELTS'),
    ('ab-wheel-rollout', 'FRONT_DELTS'),
    ('overhead-press', 'SIDE_DELTS'),
    ('arnold-press', 'SIDE_DELTS'),
    ('copenhagen-plank', 'ABS'),
    ('copenhagen-plank', 'OBLIQUES'),
    ('banded-lateral-walk', 'GLUTES'),
    ('reverse-pec-deck', 'TRAPS'),
    ('bent-over-rear-delt-fly', 'TRAPS'),
    ('front-raise', 'SIDE_DELTS'),
    ('cable-lateral-raise', 'FRONT_DELTS')
) as s (slug, muscle_group)
join exercises e on e.slug = s.slug
on conflict do nothing;

-- 4. Remaining SHOULDERS primaries (custom exercises) become SIDE_DELTS; convert primaries before secondaries.
update exercises set primary_muscle_group = 'SIDE_DELTS' where primary_muscle_group = 'SHOULDERS';

insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select s.exercise_id, 'FRONT_DELTS'
from exercise_secondary_muscle_groups s
join exercises e on e.id = s.exercise_id
where s.muscle_group = 'SHOULDERS'
  and e.primary_muscle_group <> 'FRONT_DELTS'
on conflict do nothing;

delete from exercise_secondary_muscle_groups where muscle_group = 'SHOULDERS';
