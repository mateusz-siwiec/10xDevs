package com.example.gymtrack.workout;

import com.example.gymtrack.common.ResourceNotFoundException;
import com.example.gymtrack.exercise.Exercise;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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

	static final int MIN_WEEKLY_GOAL = 1;

	static final int MAX_WEEKLY_GOAL = 14;

	private static final Duration WEEK = Duration.ofDays(7);

	private static final int WEEKS = 12;

	private static final int RECENT_RECORDS = 5;

	private static final String UNKNOWN_EXERCISE = "Unknown exercise";

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	private final UserRepository userRepository;

	private final ExerciseRepository exerciseRepository;

	private final PersonalRecordService personalRecordService;

	public DashboardService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			UserRepository userRepository, ExerciseRepository exerciseRepository,
			PersonalRecordService personalRecordService) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.userRepository = userRepository;
		this.exerciseRepository = exerciseRepository;
		this.personalRecordService = personalRecordService;
	}

	/** Sets (or clears, with null) the weekly workout goal; only integers 1..14 are accepted. */
	@Transactional
	public Integer setWeeklyGoal(UUID userId, Object value) {
		Integer goal = null;
		if (value != null) {
			if (!(value instanceof Integer number) || number < MIN_WEEKLY_GOAL || number > MAX_WEEKLY_GOAL) {
				throw new InvalidWeeklyGoalException(
						"weeklyGoal must be an integer from " + MIN_WEEKLY_GOAL + " to " + MAX_WEEKLY_GOAL + " or null");
			}
			goal = number;
		}
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new ResourceNotFoundException("User not found"));
		user.setWeeklyGoal(goal);
		userRepository.save(user);
		return goal;
	}

	/**
	 * Twelve weekly blocks (block k is {@code [now - (k+1)*7d, now - k*7d)}, k=0 current), the
	 * streak and the latest personal records, all anchored on one {@code now} and on session
	 * endedAt. The streak counts consecutive full blocks before the current one that met the goal,
	 * plus one if the current block already does.
	 */
	@Transactional(readOnly = true)
	public DashboardInsightsResponse insights(UUID userId) {
		Instant now = Instant.now();
		Map<Long, List<WorkoutSession>> byBlock = sessionRepository.findEndedBetween(userId, Instant.EPOCH, now)
			.stream()
			// minusNanos(1) keeps the block's lower edge inclusive: an age of exactly k weeks falls in block k-1.
			.collect(Collectors.groupingBy(
					session -> Duration.between(session.getEndedAt(), now).minusNanos(1).dividedBy(WEEK)));

		List<UUID> recentSessionIds = new ArrayList<>();
		for (long k = 0; k < WEEKS; k++) {
			byBlock.getOrDefault(k, List.of()).forEach(session -> recentSessionIds.add(session.getId()));
		}
		Map<UUID, BigDecimal> volumeBySession = new HashMap<>();
		if (!recentSessionIds.isEmpty()) {
			for (SessionAggregate aggregate : setRepository.aggregateBySession(recentSessionIds)) {
				volumeBySession.put(aggregate.sessionId(), aggregate.volumeKg());
			}
		}
		List<DashboardInsightsResponse.WeeklyVolume> weeklyVolume = new ArrayList<>();
		for (long k = WEEKS - 1; k >= 0; k--) {
			List<WorkoutSession> sessions = byBlock.getOrDefault(k, List.of());
			BigDecimal volume = sessions.stream()
				.map(session -> volumeBySession.getOrDefault(session.getId(), BigDecimal.ZERO))
				.reduce(BigDecimal.ZERO, BigDecimal::add);
			weeklyVolume.add(new DashboardInsightsResponse.WeeklyVolume(now.minus(WEEK.multipliedBy(k + 1)),
					sessions.size(), volume));
		}

		Integer goal = userRepository.findById(userId).map(User::getWeeklyGoal).orElse(null);
		long currentWeekWorkouts = byBlock.getOrDefault(0L, List.of()).size();
		int streakWeeks = 0;
		if (goal != null) {
			for (long k = 1; byBlock.getOrDefault(k, List.of()).size() >= goal; k++) {
				streakWeeks++;
			}
			if (currentWeekWorkouts >= goal) {
				streakWeeks++;
			}
		}

		List<PersonalRecordEntry> records = personalRecordService.recentRecords(userId, RECENT_RECORDS);
		Map<UUID, String> names = records.isEmpty() ? Map.of()
				: exerciseRepository
					.findVisibleByIdIn(records.stream().map(PersonalRecordEntry::exerciseId).distinct().toList(), userId)
					.stream()
					.collect(Collectors.toMap(Exercise::getId, Exercise::getName));
		List<DashboardInsightsResponse.RecentPersonalRecord> recent = records.stream()
			.map(record -> new DashboardInsightsResponse.RecentPersonalRecord(record.sessionId(),
					record.exerciseId(), names.getOrDefault(record.exerciseId(), UNKNOWN_EXERCISE), record.reps(),
					record.weightKg(), record.achievedAt()))
			.toList();

		return new DashboardInsightsResponse(weeklyVolume,
				new DashboardInsightsResponse.Streak(goal, streakWeeks, currentWeekWorkouts), recent);
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
