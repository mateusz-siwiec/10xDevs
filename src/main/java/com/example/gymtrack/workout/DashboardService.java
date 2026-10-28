package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregates over the user's ended workouts in a rolling window (now minus N days). Active
 * sessions never count. Data volume per user is small, so count and duration are derived in
 * memory from the session list.
 */
@Service
public class DashboardService {

	static final Set<Integer> ALLOWED_DAYS = Set.of(7, 30, 90);

	static final String ALL = "all";

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	public DashboardService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
	}

	@Transactional(readOnly = true)
	public DashboardStatsResponse stats(UUID userId, String window) {
		Instant now = Instant.now();
		if (ALL.equals(window)) {
			DashboardPeriodTotals current = totals(userId, Instant.EPOCH, now);
			return new DashboardStatsResponse(null, current.workoutCount(), current.totalDurationSeconds(),
					current.totalVolumeKg(), null);
		}
		int days = parseDays(window);
		Duration length = Duration.ofDays(days);
		DashboardPeriodTotals current = totals(userId, now.minus(length), now);
		DashboardPeriodTotals previous = totals(userId, now.minus(length.multipliedBy(2)), now.minus(length));
		return new DashboardStatsResponse(days, current.workoutCount(), current.totalDurationSeconds(),
				current.totalVolumeKg(), previous);
	}

	private static int parseDays(String window) {
		try {
			int days = Integer.parseInt(window);
			if (ALLOWED_DAYS.contains(days)) {
				return days;
			}
		}
		catch (NumberFormatException ex) {
			// falls through to the invalid-window error below
		}
		throw new InvalidDashboardWindowException("days must be 7, 30, 90 or all");
	}

	/** Totals over sessions with {@code from <= endedAt < to}. */
	private DashboardPeriodTotals totals(UUID userId, Instant from, Instant to) {
		List<WorkoutSession> sessions = sessionRepository.findEndedBetween(userId, from, to);
		long durationSeconds = sessions.stream()
			.mapToLong(session -> Duration.between(session.getStartedAt(), session.getEndedAt()).toSeconds())
			.sum();
		BigDecimal volume = setRepository.sumVolumeBetween(userId, from, to);
		return new DashboardPeriodTotals(sessions.size(), durationSeconds, volume);
	}

}
