package com.example.gymtrack.user;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@PostMapping("/api/auth/register")
	public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
		String normalizedEmail = request.email().toLowerCase();

		if (userRepository.findByEmail(normalizedEmail).isPresent()) {
			throw new EmailAlreadyExistsException(normalizedEmail);
		}

		String passwordHash = passwordEncoder.encode(request.password());
		User user = userRepository.save(new User(normalizedEmail, passwordHash));

		return ResponseEntity.status(HttpStatus.CREATED)
			.body(new RegisterResponse(user.getId(), user.getEmail()));
	}

}
