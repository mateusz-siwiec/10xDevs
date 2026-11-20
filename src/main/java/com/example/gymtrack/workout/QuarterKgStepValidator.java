package com.example.gymtrack.workout;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.math.BigDecimal;

public class QuarterKgStepValidator implements ConstraintValidator<QuarterKgStep, BigDecimal> {

	@Override
	public boolean isValid(BigDecimal value, ConstraintValidatorContext context) {
		return value == null || value.multiply(BigDecimal.valueOf(4)).remainder(BigDecimal.ONE).signum() == 0;
	}

}
