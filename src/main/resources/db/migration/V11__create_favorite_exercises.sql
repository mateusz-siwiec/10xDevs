create table favorite_exercises (
    user_id     uuid not null references users (id) on delete cascade,
    exercise_id uuid not null references exercises (id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (user_id, exercise_id)
);

create index idx_favorite_exercises_exercise_id on favorite_exercises (exercise_id);
