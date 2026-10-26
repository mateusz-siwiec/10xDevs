create table training_plans (
    id uuid not null primary key,
    user_id uuid not null references users (id),
    name varchar(60) not null,
    created_at timestamp(6) with time zone not null,
    updated_at timestamp(6) with time zone not null
);

create index idx_training_plans_user_updated_at
    on training_plans (user_id, updated_at);

create table training_plan_entries (
    id uuid not null primary key,
    plan_id uuid not null references training_plans (id) on delete cascade,
    exercise_id uuid not null references exercises (id),
    position integer not null check (position >= 0),
    constraint uq_training_plan_entries_plan_position unique (plan_id, position)
);

create index idx_training_plan_entries_exercise_id on training_plan_entries (exercise_id);
