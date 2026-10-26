package com.example.gymtrack.workout;

import com.example.gymtrack.common.ResourceNotFoundException;

public class WorkoutNotFoundException extends ResourceNotFoundException {

	public WorkoutNotFoundException(String message) {
		super(message);
	}

}
