package com.example.gymtrack.workout;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record LogSetRequest(

	@NotNull
	UUID exerciseId,

	@Min(1)
	@Max(100)
	int reps,

	/** Optional: its meaning depends on the exercise's weight mode (see WorkoutService#logSet). */
	@DecimalMin("0")
	@DecimalMax("1000")
	@QuarterKgStep
	BigDecimal weightKg,

	Boolean toFailure

) {

	/** An absent flag means "not taken to failure". */
	public LogSetRequest {
		toFailure = Boolean.TRUE.equals(toFailure);
	}

}
