-- Split CHEST into UPPER_CHEST / MID_CHEST / LOWER_CHEST and add two lower-chest catalog exercises.

-- 1. Built-in primary by slug (must run before the blanket CHEST -> MID_CHEST conversion).
update exercises set primary_muscle_group = 'UPPER_CHEST' where slug = 'incline-dumbbell-press';

-- 2. Every remaining CHEST primary (built-in and custom) becomes MID_CHEST; convert primaries before secondaries.
update exercises set primary_muscle_group = 'MID_CHEST' where primary_muscle_group = 'CHEST';

-- 3. New catalog exercises (owner_id stays NULL, id comes from the column default).
insert into exercises (slug, name, primary_muscle_group) values
    ('decline-bench-press', 'Decline Bench Press', 'LOWER_CHEST'),
    ('chest-dip', 'Chest Dip', 'LOWER_CHEST')
on conflict do nothing;

insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select e.id, s.muscle_group
from (values
    ('decline-bench-press', 'TRICEPS'),
    ('decline-bench-press', 'FRONT_DELTS'),
    ('chest-dip', 'TRICEPS'),
    ('chest-dip', 'FRONT_DELTS')
) as s (slug, muscle_group)
join exercises e on e.slug = s.slug
on conflict do nothing;

-- 4. CHEST secondaries become MID_CHEST unless the exercise's primary is already MID_CHEST.
insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select s.exercise_id, 'MID_CHEST'
from exercise_secondary_muscle_groups s
join exercises e on e.id = s.exercise_id
where s.muscle_group = 'CHEST'
  and e.primary_muscle_group <> 'MID_CHEST'
on conflict do nothing;

-- 5. Drop the legacy secondary rows.
delete from exercise_secondary_muscle_groups where muscle_group = 'CHEST';
