create table workout_sessions (
    id uuid not null primary key,
    user_id uuid not null references users (id),
    started_at timestamp(6) with time zone not null,
    ended_at timestamp(6) with time zone
);

create unique index uq_workout_sessions_active_per_user
    on workout_sessions (user_id) where ended_at is null;

create index idx_workout_sessions_user_started_at
    on workout_sessions (user_id, started_at);

create table workout_sets (
    id uuid not null primary key,
    session_id uuid not null references workout_sessions (id) on delete cascade,
    exercise_id uuid not null references exercises (id),
    reps integer not null check (reps between 1 and 100),
    weight_kg numeric(6, 2) not null check (weight_kg > 0 and weight_kg <= 1000),
    logged_at timestamp(6) with time zone not null
);

create index idx_workout_sets_session_id on workout_sets (session_id);

create index idx_workout_sets_exercise_id on workout_sets (exercise_id);
