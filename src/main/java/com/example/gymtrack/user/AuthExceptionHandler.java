package com.example.gymtrack.user;

import com.example.gymtrack.common.ErrorBody;
import com.example.gymtrack.common.ErrorCode;
import jakarta.validation.ConstraintViolation;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
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
						error.getField(), error.getCode(), bound(error, "min"), bound(error, "max"))))
			.orElseGet(() -> ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorBody.of(ErrorCode.VALIDATION_FAILED, "Validation failed")));
	}

	/**
	 * Reads a constraint bound for the message: Size has min/max attributes, Min and DecimalMin expose
	 * their {@code value} as the minimum, Max and DecimalMax as the maximum. Null when not applicable.
	 */
	private static Object bound(FieldError error, String which) {
		if (error.getCode() == null || !error.contains(ConstraintViolation.class)) {
			return null;
		}
		Map<String, Object> attributes = error.unwrap(ConstraintViolation.class)
			.getConstraintDescriptor()
			.getAttributes();
		Object value = switch (error.getCode()) {
			case "Size" -> attributes.get(which);
			case "Min", "DecimalMin" -> which.equals("min") ? attributes.get("value") : null;
			case "Max", "DecimalMax" -> which.equals("max") ? attributes.get("value") : null;
			default -> null;
		};
		return value instanceof Number || value instanceof String ? value : null;
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
