package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.UUID;

/** Per-session set count and volume, as produced by the grouped aggregate query. */
public record SessionAggregate(UUID sessionId, long setCount, BigDecimal volumeKg) {
}
