package com.example.gymtrack.common;

/**
 * Base for "not found / not yours" failures; mapped to 404 with an error body by
 * {@link CommonExceptionHandler}.
 */
public class ResourceNotFoundException extends RuntimeException {

	private final ErrorCode code;

	public ResourceNotFoundException(ErrorCode code, String message) {
		super(message);
		this.code = code;
	}

	public ErrorCode getCode() {
		return code;
	}

}
