package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.UUID;

/** Best personal-record score (weight x (30 + reps)) of one exercise; see {@link PersonalRecordService}. */
public record ExerciseScore(UUID exerciseId, BigDecimal score) {
}
