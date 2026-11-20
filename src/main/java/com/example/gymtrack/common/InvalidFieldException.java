package com.example.gymtrack.common;

/** A request field contradicts the exercise's configuration; mapped to a 400 VALIDATION_FAILED on {@code field}. */
public class InvalidFieldException extends RuntimeException {

	private final String field;

	private final String rule;

	public InvalidFieldException(String message, String field, String rule) {
		super(message);
		this.field = field;
		this.rule = rule;
	}

	public String getField() {
		return field;
	}

	public String getRule() {
		return rule;
	}

}
