package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.UUID;

public record ProgressionRecommendationResponse(UUID exerciseId, BigDecimal currentWeightKg,
		BigDecimal recommendedWeightKg, int workouts, int targetSets, int targetReps) {

}
