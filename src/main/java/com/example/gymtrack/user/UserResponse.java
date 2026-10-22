package com.example.gymtrack.user;

import java.util.UUID;

/**
 * Response shape for the authenticated user's own profile.
 */
public record UserResponse(UUID id, String email) {
}
