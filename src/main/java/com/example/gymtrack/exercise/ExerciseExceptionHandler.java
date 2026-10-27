package com.example.gymtrack.exercise;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ExerciseExceptionHandler {

	@ExceptionHandler(ExerciseConflictException.class)
	public ResponseEntity<Map<String, String>> handleConflict(ExerciseConflictException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
	}

}
