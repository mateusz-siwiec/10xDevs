package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.MuscleGroup;
import com.example.gymtrack.exercise.MuscleParent;
import java.util.List;

/**
 * {@code days} is null for the unbounded "all" window; {@code groups} lists every muscle group and
 * {@code parents} every parent, zeros included. A parent counts each set once, however many of its
 * muscles the set trained.
 */
public record MuscleGroupStatsResponse(Integer days, long totalSets, List<Group> groups, List<Parent> parents) {

	public record Group(MuscleGroup muscleGroup, long sets, long failureSets) {
	}

	public record Parent(MuscleParent parent, long sets, long failureSets) {
	}

}
