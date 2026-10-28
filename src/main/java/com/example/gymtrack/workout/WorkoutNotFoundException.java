package com.example.gymtrack.workout;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.common.ResourceNotFoundException;

public class WorkoutNotFoundException extends ResourceNotFoundException {

	public WorkoutNotFoundException(ErrorCode code, String message) {
		super(code, message);
	}

}
