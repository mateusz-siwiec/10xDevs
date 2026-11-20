package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SetResponse(UUID id, UUID exerciseId, Integer reps, Integer durationSeconds,
		BigDecimal weightKg, Instant loggedAt, boolean personalRecord, boolean toFailure) {

	static SetResponse from(WorkoutSet set, boolean personalRecord) {
		return new SetResponse(set.getId(), set.getExerciseId(), set.getReps(), set.getDurationSeconds(),
				set.getWeightKg(), set.getLoggedAt(), personalRecord, set.isToFailure());
	}

}
