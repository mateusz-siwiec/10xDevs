package com.example.gymtrack.plan;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PlanResponse(UUID id, String name, Instant createdAt, Instant updatedAt,
		List<PlanEntryResponse> exercises) {

	static PlanResponse from(TrainingPlan plan, Map<UUID, String> exerciseNames) {
		List<PlanEntryResponse> entries = plan.getEntries()
			.stream()
			.map(entry -> new PlanEntryResponse(entry.getExerciseId(), exerciseNames.get(entry.getExerciseId()),
					entry.getPosition()))
			.toList();
		return new PlanResponse(plan.getId(), plan.getName(), plan.getCreatedAt(), plan.getUpdatedAt(), entries);
	}

}
