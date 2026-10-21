package com.example.gymtrack.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class JwtServiceTest {

	private final JwtService jwtService =
		new JwtService("unit-test-signing-key-at-least-256-bits-long", 30);

	@Test
	void roundTripGenerateThenParseReturnsOriginalClaims() {
		UUID userId = UUID.randomUUID();
		String email = "round-trip@example.com";

		String token = jwtService.generateToken(userId, email);
		Optional<JwtClaims> claims = jwtService.parseToken(token);

		assertThat(claims).isPresent();
		assertThat(claims.get().userId()).isEqualTo(userId);
		assertThat(claims.get().email()).isEqualTo(email);
	}

	@Test
	void tokenSignedWithDifferentKeyFailsToParse() {
		JwtService otherKeyService =
			new JwtService("a-completely-different-signing-key-256-bits", 30);

		String token = otherKeyService.generateToken(UUID.randomUUID(), "wrong-key@example.com");

		assertThat(jwtService.parseToken(token)).isEmpty();
	}

	@Test
	void expiredTokenFailsToParse() {
		String token = jwtService.generateToken(UUID.randomUUID(), "expired@example.com", Duration.ofMillis(-1));

		assertThat(jwtService.parseToken(token)).isEmpty();
	}

}
