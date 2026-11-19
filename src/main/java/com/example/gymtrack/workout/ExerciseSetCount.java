package com.example.gymtrack.workout;

import java.util.UUID;

/** Number of logged sets (and how many were to failure) of one exercise. */
public record ExerciseSetCount(UUID exerciseId, long sets, long failureSets) {
}
