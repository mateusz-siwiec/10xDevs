package com.example.gymtrack.exercise;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Set;

public record CreateExerciseRequest(

	@NotBlank
	@Size(max = 60)
	String name,

	@NotNull
	MuscleGroup primaryMuscleGroup,

	Set<@NotNull MuscleGroup> secondaryMuscleGroups

) {

	@JsonIgnore
	@AssertTrue(message = "must not contain the primary muscle group")
	public boolean isSecondaryMuscleGroupsExcludePrimary() {
		return secondaryMuscleGroups == null || primaryMuscleGroup == null
				|| !secondaryMuscleGroups.contains(primaryMuscleGroup);
	}

}
