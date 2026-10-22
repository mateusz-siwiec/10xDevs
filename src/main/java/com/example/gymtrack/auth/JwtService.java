package com.example.gymtrack.auth;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Single place that signs and parses JWTs, shared by the auth endpoints
 * (issuance) and {@link JwtAuthenticationFilter} (verification).
 */
@Service
public class JwtService {

	private static final String EMAIL_CLAIM = "email";
	private static final String INSECURE_DEFAULT_SECRET = "dev-only-insecure-default-change-me";

	private final SecretKey signingKey;
	private final Duration defaultExpiration;

	public JwtService(
		@Value("${JWT_SECRET:" + INSECURE_DEFAULT_SECRET + "}") String secret,
		@Value("${jwt.expiration-days:30}") long expirationDays
	) {
		if (INSECURE_DEFAULT_SECRET.equals(secret)) {
			throw new IllegalStateException(
				"JWT_SECRET is not set. Refusing to start with the public default signing key " +
				"- set the JWT_SECRET environment variable (e.g. via `fly secrets set` in production)."
			);
		}
		this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
		this.defaultExpiration = Duration.ofDays(expirationDays);
	}

	public String generateToken(UUID userId, String email) {
		return generateToken(userId, email, defaultExpiration);
	}

	/**
	 * Test-only escape hatch so expiry rejection can be exercised without
	 * waiting on the real (30-day default) expiration window.
	 */
	String generateToken(UUID userId, String email, Duration expiration) {
		Instant now = Instant.now();

		return Jwts.builder()
			.subject(userId.toString())
			.claim(EMAIL_CLAIM, email)
			.issuedAt(Date.from(now))
			.expiration(Date.from(now.plus(expiration)))
			.signWith(signingKey)
			.compact();
	}

	public Optional<JwtClaims> parseToken(String token) {
		try {
			var claims = Jwts.parser()
				.verifyWith(signingKey)
				.build()
				.parseSignedClaims(token)
				.getPayload();

			UUID userId = UUID.fromString(claims.getSubject());
			String email = claims.get(EMAIL_CLAIM, String.class);

			return Optional.of(new JwtClaims(userId, email));
		} catch (JwtException | IllegalArgumentException ex) {
			return Optional.empty();
		}
	}

}
