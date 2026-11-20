alter table exercises add column measure varchar(16) not null default 'REPS'
    check (measure in ('REPS', 'DURATION'));

update exercises set measure = 'DURATION'
    where slug in ('plank', 'copenhagen-plank');

alter table workout_sets alter column reps drop not null;
alter table workout_sets add column duration_seconds integer;
alter table workout_sets drop constraint workout_sets_reps_check;
alter table workout_sets add constraint workout_sets_reps_check
    check (reps between 1 and 100);
alter table workout_sets add constraint ck_workout_sets_duration_seconds
    check (duration_seconds between 1 and 3600);
alter table workout_sets add constraint ck_workout_sets_reps_xor_duration
    check ((reps is not null) <> (duration_seconds is not null));

alter table training_plan_entries alter column reps drop not null;
alter table training_plan_entries add column target_duration_seconds integer;
alter table training_plan_entries add constraint ck_training_plan_entries_target_duration_seconds
    check (target_duration_seconds between 1 and 3600);
alter table training_plan_entries add constraint ck_training_plan_entries_reps_xor_duration
    check ((reps is not null) <> (target_duration_seconds is not null));
