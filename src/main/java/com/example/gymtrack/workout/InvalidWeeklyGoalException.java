package com.example.gymtrack.workout;

import com.example.gymtrack.common.ErrorCode;

public class InvalidWeeklyGoalException extends RuntimeException {

	private final ErrorCode code;

	public InvalidWeeklyGoalException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
