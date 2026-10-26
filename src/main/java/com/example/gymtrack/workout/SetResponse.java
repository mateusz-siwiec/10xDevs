package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SetResponse(UUID id, UUID exerciseId, int reps, BigDecimal weightKg, Instant loggedAt) {

	static SetResponse from(WorkoutSet set) {
		return new SetResponse(set.getId(), set.getExerciseId(), set.getReps(), set.getWeightKg(),
				set.getLoggedAt());
	}

}
