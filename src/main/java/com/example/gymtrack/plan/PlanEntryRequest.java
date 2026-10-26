package com.example.gymtrack.plan;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PlanEntryRequest(

	@NotNull
	UUID exerciseId,

	@NotNull
	@Min(1)
	@Max(20)
	Integer sets,

	@NotNull
	@Min(1)
	@Max(100)
	Integer reps

) {

	PlanEntryInput toInput() {
		return new PlanEntryInput(exerciseId, sets, reps);
	}

}
