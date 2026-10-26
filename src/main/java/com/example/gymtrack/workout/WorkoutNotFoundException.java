package com.example.gymtrack.workout;

public class WorkoutNotFoundException extends RuntimeException {

	public WorkoutNotFoundException(String message) {
		super(message);
	}

}
