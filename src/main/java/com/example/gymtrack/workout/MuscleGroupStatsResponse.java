package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.MuscleGroup;
import java.util.List;

/** {@code days} is null for the unbounded "all" window; {@code groups} lists every muscle group, zeros included. */
public record MuscleGroupStatsResponse(Integer days, long totalSets, List<Group> groups) {

	public record Group(MuscleGroup muscleGroup, long sets) {
	}

}
