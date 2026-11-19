package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One chart point. {@code metric} says what {@code value} measures: the session's top weight (kg) or
 * its top reps. {@code topWeightKg} is always the session's top weight (0 for bodyweight sets).
 */
public record ProgressionPointResponse(UUID sessionId, Instant date, BigDecimal topWeightKg, Metric metric,
		BigDecimal value) {

	public enum Metric {
		WEIGHT, REPS
	}

}
