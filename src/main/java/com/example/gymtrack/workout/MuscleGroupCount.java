package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.MuscleGroup;

/** Number of logged sets whose exercise has {@code muscleGroup} as its primary group. */
public record MuscleGroupCount(MuscleGroup muscleGroup, long sets) {
}
