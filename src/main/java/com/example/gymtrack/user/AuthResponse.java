package com.example.gymtrack.user;

import java.util.UUID;

/**
 * Shared success response for both register and login - registration
 * auto-logs-in, so both return the same {token, id, email} shape.
 */
public record AuthResponse(String token, UUID id, String email) {
}
