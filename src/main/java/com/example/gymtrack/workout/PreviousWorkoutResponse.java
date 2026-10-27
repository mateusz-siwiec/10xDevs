package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PreviousWorkoutResponse(UUID exerciseId, UUID sessionId, Instant endedAt, List<SetEntry> sets) {

	public record SetEntry(int reps, BigDecimal weightKg) {
	}

}
