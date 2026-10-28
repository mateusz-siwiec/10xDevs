package com.example.gymtrack.workout;

import java.math.BigDecimal;

public record DashboardPeriodTotals(long workoutCount, long totalDurationSeconds, BigDecimal totalVolumeKg) {

}
