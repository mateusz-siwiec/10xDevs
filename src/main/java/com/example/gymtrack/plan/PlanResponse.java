package com.example.gymtrack.plan;

import com.example.gymtrack.exercise.Exercise;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PlanResponse(UUID id, String name, Instant createdAt, Instant updatedAt,
		List<PlanEntryResponse> exercises) {

	static PlanResponse from(TrainingPlan plan, Map<UUID, Exercise> exercises) {
		List<PlanEntryResponse> entries = plan.getEntries().stream().map(entry -> {
			Exercise exercise = exercises.get(entry.getExerciseId());
			return new PlanEntryResponse(entry.getExerciseId(), exercise.getName(), exercise.getSlug(),
					entry.getPosition(), entry.getSets(), entry.getReps());
		}).toList();
		return new PlanResponse(plan.getId(), plan.getName(), plan.getCreatedAt(), plan.getUpdatedAt(), entries);
	}

}
