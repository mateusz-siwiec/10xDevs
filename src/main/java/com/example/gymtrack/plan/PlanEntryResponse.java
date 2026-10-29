package com.example.gymtrack.plan;

import java.util.UUID;

public record PlanEntryResponse(UUID exerciseId, String exerciseName, String exerciseSlug, int position, int sets, int reps) {
}
