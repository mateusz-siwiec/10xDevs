package com.example.gymtrack.user;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(

	@NotBlank
	String email,

	@NotBlank
	String password

) {
}
