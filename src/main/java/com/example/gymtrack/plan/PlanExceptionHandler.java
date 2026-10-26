package com.example.gymtrack.plan;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Validation and malformed-UUID failures are mapped globally (AuthExceptionHandler,
 * WorkoutExceptionHandler); unknown exercises reuse WorkoutNotFoundException, as in logSet.
 */
@RestControllerAdvice
public class PlanExceptionHandler {

	@ExceptionHandler(PlanNotFoundException.class)
	public ResponseEntity<Map<String, String>> handleNotFound(PlanNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
	}

}
