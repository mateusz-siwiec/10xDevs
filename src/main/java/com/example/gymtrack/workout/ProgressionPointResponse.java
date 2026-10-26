package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ProgressionPointResponse(UUID sessionId, Instant date, BigDecimal topWeightKg) {

}
