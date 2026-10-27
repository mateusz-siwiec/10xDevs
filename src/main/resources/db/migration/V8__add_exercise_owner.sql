alter table exercises
    add column owner_id uuid references users (id) on delete cascade;

create index idx_exercises_owner_id on exercises (owner_id);

create unique index uq_exercises_owner_lower_name
    on exercises (owner_id, lower(name))
    where owner_id is not null;
