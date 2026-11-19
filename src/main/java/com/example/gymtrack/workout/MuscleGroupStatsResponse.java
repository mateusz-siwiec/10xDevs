package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.MuscleGroup;
import com.example.gymtrack.exercise.MuscleParent;
import java.util.List;

/**
 * {@code days} is null for the unbounded "all" window; {@code groups} lists every muscle group and
 * {@code parents} every parent, zeros included. {@code sets} counts sets whose exercise has the entry as its
 * primary muscle (so {@code totalSets} is their sum) and {@code failureSets} the to-failure subset of those;
 * {@code secondarySets} counts sets whose exercise lists it as a secondary muscle. A parent counts each set at
 * most once under {@code sets} (the primary muscle belongs to it) and at most once under {@code secondarySets}
 * (any secondary muscle belongs to it, even several), so one set can appear in both but never twice in one.
 */
public record MuscleGroupStatsResponse(Integer days, long totalSets, List<Group> groups, List<Parent> parents) {

	public record Group(MuscleGroup muscleGroup, long sets, long secondarySets, long failureSets) {
	}

	public record Parent(MuscleParent parent, long sets, long secondarySets, long failureSets) {
	}

}
