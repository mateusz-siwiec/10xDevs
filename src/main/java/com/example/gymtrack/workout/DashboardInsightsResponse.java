package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Window-independent dashboard insights. {@code weeklyVolume} has 12 items, oldest first;
 * {@code recentPersonalRecords} has at most 5, newest first.
 */
public record DashboardInsightsResponse(List<WeeklyVolume> weeklyVolume, Streak streak,
		List<RecentPersonalRecord> recentPersonalRecords) {

	/** {@code weekStart} is the start instant of the 7-day block. */
	public record WeeklyVolume(Instant weekStart, long workoutCount, BigDecimal volumeKg) {
	}

	/** {@code goal} is null when the user has not set one; {@code weeks} is then 0. */
	public record Streak(Integer goal, int weeks, long currentWeekWorkouts) {
	}

	public record RecentPersonalRecord(UUID sessionId, UUID exerciseId, String exerciseName, int reps,
			BigDecimal weightKg, Instant achievedAt) {
	}

}
