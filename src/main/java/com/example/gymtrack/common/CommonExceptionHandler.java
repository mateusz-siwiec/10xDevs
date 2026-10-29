package com.example.gymtrack.common;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Cross-cutting error mapping in the {"error": ..., "code": ...} shape. Bean-validation failures
 * are handled by AuthExceptionHandler and malformed path/query values by WorkoutExceptionHandler.
 */
@RestControllerAdvice
public class CommonExceptionHandler {

	@ExceptionHandler(ResourceNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(ResourceNotFoundException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<Map<String, Object>> handleUnreadableBody(HttpMessageNotReadableException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(ErrorBody.of(ErrorCode.MALFORMED_BODY, "Malformed request body"));
	}

}
