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

	static final Set<Integer> ALLOWED_DAYS = Set.of(7, 30);

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	public DashboardService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
	}

	@Transactional(readOnly = true)
	public DashboardStatsResponse stats(UUID userId, int days) {
		if (!ALLOWED_DAYS.contains(days)) {
			throw new InvalidDashboardWindowException("days must be 7 or 30");
		}
		Instant since = Instant.now().minus(Duration.ofDays(days));
		List<WorkoutSession> sessions = sessionRepository.findEndedSince(userId, since);
		long durationSeconds = sessions.stream()
			.mapToLong(session -> Duration.between(session.getStartedAt(), session.getEndedAt()).toSeconds())
			.sum();
		BigDecimal volume = setRepository.sumVolumeSince(userId, since);
		return new DashboardStatsResponse(days, sessions.size(), durationSeconds, volume);
	}

}
