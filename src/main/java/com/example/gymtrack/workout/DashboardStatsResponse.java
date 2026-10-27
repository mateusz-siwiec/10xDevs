package com.example.gymtrack.workout;

import java.math.BigDecimal;

public record DashboardStatsResponse(int days, long workoutCount, long totalDurationSeconds,
		BigDecimal totalVolumeKg) {

}
