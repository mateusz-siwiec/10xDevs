package com.example.gymtrack.plan;

import com.example.gymtrack.common.ResourceNotFoundException;

public class PlanNotFoundException extends ResourceNotFoundException {

	public PlanNotFoundException(String message) {
		super(message);
	}

}
