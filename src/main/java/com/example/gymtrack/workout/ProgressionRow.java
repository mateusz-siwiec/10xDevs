package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Per-session maxima of one exercise, the raw input of the progression chart. */
public record ProgressionRow(UUID sessionId, Instant date, BigDecimal topWeightKg, Integer topReps) {
}
