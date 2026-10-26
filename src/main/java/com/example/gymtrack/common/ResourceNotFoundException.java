package com.example.gymtrack.common;

/**
 * Base for "not found / not yours" failures; mapped to 404 with an error body by
 * {@link CommonExceptionHandler}.
 */
public class ResourceNotFoundException extends RuntimeException {

	public ResourceNotFoundException(String message) {
		super(message);
	}

}
