package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SetResponse(UUID id, UUID exerciseId, int reps, BigDecimal weightKg, Instant loggedAt,
		boolean personalRecord) {

	static SetResponse from(WorkoutSet set, boolean personalRecord) {
		return new SetResponse(set.getId(), set.getExerciseId(), set.getReps(), set.getWeightKg(),
				set.getLoggedAt(), personalRecord);
	}

}
