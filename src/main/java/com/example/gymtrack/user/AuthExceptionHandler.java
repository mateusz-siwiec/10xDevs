package com.example.gymtrack.user;

import com.example.gymtrack.common.ErrorBody;
import com.example.gymtrack.common.ErrorCode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
		return ex.getBindingResult().getFieldErrors().stream()
			.findFirst()
			.map(error -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorBody.of(ErrorCode.VALIDATION_FAILED, error.getField() + " " + error.getDefaultMessage(),
						error.getField(), error.getCode())))
			.orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorBody.of(ErrorCode.VALIDATION_FAILED, "Validation failed")));
	}

	@ExceptionHandler(EmailAlreadyExistsException.class)
	public ResponseEntity<Map<String, Object>> handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorBody.of(ErrorCode.EMAIL_ALREADY_EXISTS, ex.getMessage()));
	}

	@ExceptionHandler(InvalidCredentialsException.class)
	public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorBody.of(ErrorCode.INVALID_CREDENTIALS, ex.getMessage()));
	}

}
