package com.example.gymtrack.workout;

import com.example.gymtrack.common.ErrorBody;
import com.example.gymtrack.common.ErrorCode;
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
	public ResponseEntity<Map<String, Object>> handleConflict(WorkoutConflictException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

	@ExceptionHandler(InvalidDashboardWindowException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidWindow(InvalidDashboardWindowException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

	@ExceptionHandler(InvalidWeeklyGoalException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidWeeklyGoal(InvalidWeeklyGoalException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

	@ExceptionHandler(InvalidHistoryQueryException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidHistoryQuery(InvalidHistoryQueryException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ErrorBody.of(ErrorCode.INVALID_PARAMETER, "Invalid " + ex.getName(), ex.getName(), null));
	}

}
