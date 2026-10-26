package com.example.gymtrack.workout;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Bean-validation failures (MethodArgumentNotValidException) are already mapped to the
 * error-body shape by the global AuthExceptionHandler, so they are not handled here.
 */
@RestControllerAdvice
public class WorkoutExceptionHandler {

	@ExceptionHandler(WorkoutNotFoundException.class)
	public ResponseEntity<Map<String, String>> handleNotFound(WorkoutNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(WorkoutConflictException.class)
	public ResponseEntity<Map<String, String>> handleConflict(WorkoutConflictException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(InvalidWeightException.class)
	public ResponseEntity<Map<String, String>> handleInvalidWeight(InvalidWeightException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
	}

}
