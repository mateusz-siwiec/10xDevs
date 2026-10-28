package com.example.gymtrack.workout;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Bean-validation failures (MethodArgumentNotValidException) are already mapped to the
 * error-body shape by the global AuthExceptionHandler, so they are not handled here.
 */
@RestControllerAdvice
public class WorkoutExceptionHandler {

	@ExceptionHandler(WorkoutConflictException.class)
	public ResponseEntity<Map<String, String>> handleConflict(WorkoutConflictException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(InvalidDashboardWindowException.class)
	public ResponseEntity<Map<String, String>> handleInvalidWindow(InvalidDashboardWindowException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(InvalidWeeklyGoalException.class)
	public ResponseEntity<Map<String, String>> handleInvalidWeeklyGoal(InvalidWeeklyGoalException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(InvalidHistoryQueryException.class)
	public ResponseEntity<Map<String, String>> handleInvalidHistoryQuery(InvalidHistoryQueryException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", ex.getMessage()));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid " + ex.getName()));
	}

}
