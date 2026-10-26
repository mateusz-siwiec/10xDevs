alter table training_plan_entries add column sets integer;
alter table training_plan_entries add column reps integer;

update training_plan_entries set sets = 3, reps = 10;

alter table training_plan_entries alter column sets set not null;
alter table training_plan_entries alter column reps set not null;

alter table training_plan_entries
    add constraint ck_training_plan_entries_sets check (sets between 1 and 20);
alter table training_plan_entries
    add constraint ck_training_plan_entries_reps check (reps between 1 and 100);
