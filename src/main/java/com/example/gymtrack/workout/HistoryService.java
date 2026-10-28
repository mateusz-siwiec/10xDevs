package com.example.gymtrack.workout;

import com.example.gymtrack.plan.TrainingPlan;
import com.example.gymtrack.plan.TrainingPlanRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Paged list and detail of the user's ended workouts. Running sessions are never exposed. */
@Service
public class HistoryService {

	static final int MAX_SIZE = 50;

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("endedAt"), Sort.Order.desc("startedAt"),
			Sort.Order.desc("id"));

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	private final TrainingPlanRepository planRepository;

	private final PersonalRecordService personalRecordService;

	public HistoryService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			TrainingPlanRepository planRepository, PersonalRecordService personalRecordService) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.planRepository = planRepository;
		this.personalRecordService = personalRecordService;
	}

	@Transactional(readOnly = true)
	public HistoryPageResponse list(UUID userId, int page, int size, UUID planId, boolean noPlan) {
		if (page < 0) {
			throw new InvalidHistoryQueryException("page must be 0 or greater");
		}
		if (size < 1 || size > MAX_SIZE) {
			throw new InvalidHistoryQueryException("size must be between 1 and " + MAX_SIZE);
		}
		if (planId != null && noPlan) {
			throw new InvalidHistoryQueryException("planId and noPlan cannot be combined");
		}
		Pageable pageable = PageRequest.of(page, size, NEWEST_FIRST);
		Page<WorkoutSession> result;
		if (planId != null) {
			result = sessionRepository.findEndedByUserAndPlan(userId, planId, pageable);
		}
		else if (noPlan) {
			result = sessionRepository.findEndedByUserWithoutPlan(userId, pageable);
		}
		else {
			result = sessionRepository.findEndedByUser(userId, pageable);
		}
		List<WorkoutSession> sessions = result.getContent();
		Map<UUID, SessionAggregate> aggregates = sessions.isEmpty() ? Map.of()
				: setRepository.aggregateBySession(sessions.stream().map(WorkoutSession::getId).toList())
					.stream()
					.collect(Collectors.toMap(SessionAggregate::sessionId, aggregate -> aggregate));
		Map<UUID, String> planNames = planNames(userId, sessions);
		List<HistoryItemResponse> items = sessions.stream().map(session -> {
			SessionAggregate aggregate = aggregates.get(session.getId());
			return new HistoryItemResponse(session.getId(), session.getStartedAt(), session.getEndedAt(),
					session.getPlanId(), planNames.get(session.getPlanId()), durationSeconds(session),
					aggregate == null ? 0 : aggregate.setCount(),
					aggregate == null ? BigDecimal.ZERO : aggregate.volumeKg());
		}).toList();
		return new HistoryPageResponse(items, result.getNumber(), result.getSize(), result.getTotalElements(),
				result.getTotalPages());
	}

	@Transactional(readOnly = true)
	public HistoryDetailResponse detail(UUID userId, UUID sessionId) {
		WorkoutSession session = sessionRepository.findByIdAndUserId(sessionId, userId)
			.filter(found -> found.getEndedAt() != null)
			.orElseThrow(() -> new WorkoutNotFoundException("Workout session not found"));
		Map<UUID, List<HistoryDetailResponse.SetEntry>> byExercise = new LinkedHashMap<>();
		BigDecimal volume = BigDecimal.ZERO;
		List<WorkoutSet> sets = setRepository.findBySessionIdOrderByLoggedAtAscIdAsc(session.getId());
		Set<UUID> personalRecordSetIds = personalRecordService.personalRecordSetIds(session, sets);
		for (WorkoutSet set : sets) {
			byExercise.computeIfAbsent(set.getExerciseId(), key -> new ArrayList<>())
				.add(new HistoryDetailResponse.SetEntry(set.getReps(), set.getWeightKg(),
						personalRecordSetIds.contains(set.getId())));
			volume = volume.add(set.getWeightKg().multiply(BigDecimal.valueOf(set.getReps())));
		}
		List<HistoryDetailResponse.ExerciseEntry> exercises = byExercise.entrySet()
			.stream()
			.map(entry -> new HistoryDetailResponse.ExerciseEntry(entry.getKey(), entry.getValue()))
			.toList();
		String planName = planNames(userId, List.of(session)).get(session.getPlanId());
		return new HistoryDetailResponse(session.getId(), session.getStartedAt(), session.getEndedAt(),
				session.getPlanId(), planName, durationSeconds(session), volume, exercises);
	}

	/** Names of the user's live plans among the sessions' plan ids; unknown or foreign plans are absent. */
	private Map<UUID, String> planNames(UUID userId, List<WorkoutSession> sessions) {
		Set<UUID> planIds = sessions.stream()
			.map(WorkoutSession::getPlanId)
			.filter(Objects::nonNull)
			.collect(Collectors.toSet());
		if (planIds.isEmpty()) {
			// Collections.emptyMap, not Map.of: lookups with a null (free-form) planId must not throw.
			return Collections.emptyMap();
		}
		return planRepository.findAllById(planIds)
			.stream()
			.filter(plan -> plan.getUserId().equals(userId))
			.collect(Collectors.toMap(TrainingPlan::getId, TrainingPlan::getName));
	}

	private static long durationSeconds(WorkoutSession session) {
		return Duration.between(session.getStartedAt(), session.getEndedAt()).toSeconds();
	}

}
