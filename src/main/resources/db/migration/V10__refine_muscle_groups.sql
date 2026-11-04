-- Refine muscle groups: BACK becomes LATS / TRAPS / LOWER_BACK, CORE becomes ABS / OBLIQUES, and FOREARMS is added.

-- 1. Built-in primaries (by slug).
update exercises set primary_muscle_group = 'LOWER_BACK' where slug = 'deadlift';
update exercises set primary_muscle_group = 'LATS' where slug in ('pull-up', 'barbell-row', 'lat-pulldown');

-- 2. Built-in secondaries: replace BACK by slug (hanging-leg-raise only keeps its grip work).
delete from exercise_secondary_muscle_groups
where muscle_group = 'BACK'
  and exercise_id in (select id from exercises
                      where slug in ('face-pull', 'romanian-deadlift', 'good-morning', 'hanging-leg-raise'));

insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select e.id, s.muscle_group
from (values
    ('face-pull', 'TRAPS'),
    ('romanian-deadlift', 'LOWER_BACK'),
    ('good-morning', 'LOWER_BACK'),
    ('barbell-row', 'TRAPS'),
    ('barbell-row', 'FOREARMS'),
    ('pull-up', 'FOREARMS'),
    ('deadlift', 'TRAPS'),
    ('deadlift', 'FOREARMS'),
    ('hanging-leg-raise', 'FOREARMS'),
    ('hammer-curl', 'FOREARMS'),
    ('plank', 'OBLIQUES'),
    ('ab-wheel-rollout', 'OBLIQUES')
) as s (slug, muscle_group)
join exercises e on e.slug = s.slug
on conflict do nothing;

-- 3. Remaining BACK values (custom exercises) become LATS.
update exercises set primary_muscle_group = 'LATS' where primary_muscle_group = 'BACK';

insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select s.exercise_id, 'LATS'
from exercise_secondary_muscle_groups s
join exercises e on e.id = s.exercise_id
where s.muscle_group = 'BACK'
  and e.primary_muscle_group <> 'LATS'
on conflict do nothing;

delete from exercise_secondary_muscle_groups where muscle_group = 'BACK';

-- 4. CORE becomes ABS everywhere (built-in and custom); OBLIQUES is only added where listed above.
update exercises set primary_muscle_group = 'ABS' where primary_muscle_group = 'CORE';

insert into exercise_secondary_muscle_groups (exercise_id, muscle_group)
select s.exercise_id, 'ABS'
from exercise_secondary_muscle_groups s
join exercises e on e.id = s.exercise_id
where s.muscle_group = 'CORE'
  and e.primary_muscle_group <> 'ABS'
on conflict do nothing;

delete from exercise_secondary_muscle_groups where muscle_group = 'CORE';
