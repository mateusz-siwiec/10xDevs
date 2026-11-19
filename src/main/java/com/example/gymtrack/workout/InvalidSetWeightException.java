package com.example.gymtrack.workout;

/** The logged weight contradicts the exercise's weight mode; mapped to a 400 VALIDATION_FAILED on {@code weightKg}. */
public class InvalidSetWeightException extends RuntimeException {

	private final String rule;

	public InvalidSetWeightException(String message, String rule) {
		super(message);
		this.rule = rule;
	}

	public String getRule() {
		return rule;
	}

}
