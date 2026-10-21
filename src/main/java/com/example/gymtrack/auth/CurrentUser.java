package com.example.gymtrack.auth;

import java.util.UUID;

public record CurrentUser(UUID id, String email) {
}
