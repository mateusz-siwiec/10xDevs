package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.UUID;

/** Personal-record score (weight x (30 + reps)) and reps of one eligible set; see {@link PersonalRecordService}. */
public record ExerciseScore(UUID exerciseId, BigDecimal score, int reps) {
}
