-- V17 turned plank and copenhagen-plank into timed exercises, but plans saved earlier hold them as rep targets.
-- The exactly-one-target rule rejects such an entry on the next save, so give them a seconds target (30 s).
update training_plan_entries e
    set target_duration_seconds = 30,
        reps = null
    from exercises x
    where x.id = e.exercise_id
      and x.measure = 'DURATION'
      and e.reps is not null;
