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

	@NotNull
	@DecimalMin(value = "0", inclusive = false)
	@DecimalMax("1000")
	@HalfKgStep
	BigDecimal weightKg

) {
}
