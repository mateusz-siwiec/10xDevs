package com.example.gymtrack.plan;

import java.util.UUID;

public record PlanEntryInput(UUID exerciseId, int sets, Integer reps, Integer targetDurationSeconds) {

	public PlanEntryInput(UUID exerciseId, int sets, int reps) {
		this(exerciseId, sets, Integer.valueOf(reps), null);
	}

}
