package com.example.gymtrack.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(

	@NotBlank
	String email,

	@NotBlank
	@Size(max = 72)
	String password

) {
}
