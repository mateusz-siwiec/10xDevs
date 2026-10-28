package com.example.gymtrack.exercise;

import com.example.gymtrack.common.ErrorCode;

public class ExerciseConflictException extends RuntimeException {

	private final ErrorCode code;

	public ExerciseConflictException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
