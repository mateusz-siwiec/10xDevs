package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record HistoryItemResponse(UUID id, Instant startedAt, Instant endedAt, UUID planId, String planName,
		long durationSeconds, long setCount, BigDecimal volumeKg) {
}
