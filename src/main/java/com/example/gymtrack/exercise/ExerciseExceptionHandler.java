package com.example.gymtrack.exercise;

import com.example.gymtrack.common.ErrorBody;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ExerciseExceptionHandler {

	@ExceptionHandler(ExerciseConflictException.class)
	public ResponseEntity<Map<String, Object>> handleConflict(ExerciseConflictException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorBody.of(ex.getCode(), ex.getMessage()));
	}

}
