package com.example.gymtrack.auth;

import java.util.UUID;

public record JwtClaims(UUID userId, String email) {
}
