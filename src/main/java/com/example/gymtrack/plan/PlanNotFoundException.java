package com.example.gymtrack.plan;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.common.ResourceNotFoundException;

public class PlanNotFoundException extends ResourceNotFoundException {

	public PlanNotFoundException(String message) {
		super(ErrorCode.PLAN_NOT_FOUND, message);
	}

}
