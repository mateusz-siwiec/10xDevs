package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record HistoryDetailResponse(UUID id, Instant startedAt, Instant endedAt, UUID planId, String planName,
		long durationSeconds, BigDecimal volumeKg, List<ExerciseEntry> exercises) {

	public record ExerciseEntry(UUID exerciseId, List<SetEntry> sets) {
	}

	public record SetEntry(int reps, BigDecimal weightKg, boolean personalRecord) {
	}

}
