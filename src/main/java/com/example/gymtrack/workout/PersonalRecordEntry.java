package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A set that beat the user's earlier best for its exercise, with the time it was logged. */
public record PersonalRecordEntry(UUID sessionId, UUID exerciseId, int reps, BigDecimal weightKg,
		Instant achievedAt) {
}
