package com.example.gymtrack.user;

/**
 * Thrown when registration is attempted with an email that already exists
 * (case-insensitive match).
 */
public class EmailAlreadyExistsException extends RuntimeException {

	public EmailAlreadyExistsException(String email) {
		super("An account with email " + email + " already exists");
	}

}
