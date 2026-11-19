alter table exercises add column weight_mode varchar(16) not null default 'REQUIRED'
    check (weight_mode in ('REQUIRED', 'OPTIONAL', 'NONE'));

alter table workout_sets drop constraint workout_sets_weight_kg_check;
alter table workout_sets add constraint workout_sets_weight_kg_check
    check (weight_kg >= 0 and weight_kg <= 1000);

update exercises set weight_mode = 'NONE'
    where slug in ('ab-wheel-rollout', 'banded-lateral-walk', 'copenhagen-plank');

update exercises set weight_mode = 'OPTIONAL'
    where slug in ('pull-up', 'chest-dip', 'push-up', 'hanging-leg-raise', 'plank');
