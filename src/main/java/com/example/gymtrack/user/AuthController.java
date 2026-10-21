package com.example.gymtrack.user;

import com.example.gymtrack.auth.JwtService;
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
	private final JwtService jwtService;

	public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
		this.userRepository = userRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
	}

	@PostMapping("/api/auth/register")
	public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
		String normalizedEmail = request.email().toLowerCase();

		if (userRepository.findByEmail(normalizedEmail).isPresent()) {
			throw new EmailAlreadyExistsException(normalizedEmail);
		}

		String passwordHash = passwordEncoder.encode(request.password());
		User user = userRepository.save(new User(normalizedEmail, passwordHash));
		String token = jwtService.generateToken(user.getId(), user.getEmail());

		return ResponseEntity.status(HttpStatus.CREATED)
			.body(new AuthResponse(token, user.getId(), user.getEmail()));
	}

	@PostMapping("/api/auth/login")
	public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
		String normalizedEmail = request.email().toLowerCase();

		User user = userRepository.findByEmail(normalizedEmail)
			.orElseThrow(InvalidCredentialsException::new);

		if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new InvalidCredentialsException();
		}

		String token = jwtService.generateToken(user.getId(), user.getEmail());

		return ResponseEntity.ok(new AuthResponse(token, user.getId(), user.getEmail()));
	}

}
