package com.example.gymtrack.user;

/**
 * Thrown on login failure - either the email doesn't exist or the password
 * doesn't match. The message is intentionally generic; callers must not
 * expose which cause it was (avoids user enumeration).
 */
public class InvalidCredentialsException extends RuntimeException {

	public InvalidCredentialsException() {
		super("Invalid email or password");
	}

}
