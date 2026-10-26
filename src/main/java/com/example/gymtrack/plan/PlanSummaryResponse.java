package com.example.gymtrack.plan;

import java.time.Instant;
import java.util.UUID;

public record PlanSummaryResponse(UUID id, String name, int exerciseCount, Instant updatedAt) {

	static PlanSummaryResponse from(TrainingPlan plan) {
		return new PlanSummaryResponse(plan.getId(), plan.getName(), plan.getEntries().size(), plan.getUpdatedAt());
	}

}
