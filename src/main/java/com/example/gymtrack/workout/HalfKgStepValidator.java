package com.example.gymtrack.workout;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.math.BigDecimal;

public class HalfKgStepValidator implements ConstraintValidator<HalfKgStep, BigDecimal> {

	@Override
	public boolean isValid(BigDecimal value, ConstraintValidatorContext context) {
		return value == null || value.multiply(BigDecimal.TWO).remainder(BigDecimal.ONE).signum() == 0;
	}

}
