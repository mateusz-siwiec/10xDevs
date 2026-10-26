alter table workout_sessions
    add column plan_id uuid references training_plans (id) on delete set null;

create index idx_workout_sessions_plan_id on workout_sessions (plan_id);
