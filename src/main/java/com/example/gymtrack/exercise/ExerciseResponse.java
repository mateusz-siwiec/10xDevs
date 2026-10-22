package com.example.gymtrack.exercise;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

/**
 * Response shape for a catalog exercise.
 */
public record ExerciseResponse(UUID id, String slug, String name, MuscleGroup primaryMuscleGroup,
		Set<MuscleGroup> secondaryMuscleGroups) {

	static ExerciseResponse from(Exercise exercise) {
		Set<MuscleGroup> secondary = EnumSet.noneOf(MuscleGroup.class);
		secondary.addAll(exercise.getSecondaryMuscleGroups());
		return new ExerciseResponse(exercise.getId(), exercise.getSlug(), exercise.getName(),
				exercise.getPrimaryMuscleGroup(), secondary);
	}

}
