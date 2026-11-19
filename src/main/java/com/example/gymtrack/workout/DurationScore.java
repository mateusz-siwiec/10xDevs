package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.UUID;

/** Duration and weight of one duration set, the baseline input of duration personal records; see {@link PersonalRecordService}. */
public record DurationScore(UUID exerciseId, int durationSeconds, BigDecimal weightKg) {
}
