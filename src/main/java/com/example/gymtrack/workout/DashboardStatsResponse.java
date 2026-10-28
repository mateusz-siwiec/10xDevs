package com.example.gymtrack.workout;

import java.math.BigDecimal;

/** {@code days} and {@code previous} are null for the unbounded "all" window. */
public record DashboardStatsResponse(Integer days, long workoutCount, long totalDurationSeconds,
		BigDecimal totalVolumeKg, DashboardPeriodTotals previous) {

}
