package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.plan.TrainingPlanEntry;
import com.example.gymtrack.plan.TrainingPlanRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-011 heuristic: suggest a heavier weight once the last {@link #REQUIRED_WORKOUTS} ended
 * workouts of an exercise all hit the plan target at the same top weight. Targets are read from
 * the plan at evaluation time, so plan edits re-judge older sessions.
 */
@Service
public class ProgressionRecommendationService {

	static final int REQUIRED_WORKOUTS = 2;

	static final BigDecimal INCREASE = new BigDecimal("1.025");

	private static final BigDecimal MIN_STEP = new BigDecimal("0.5");

	private static final BigDecimal MAX_WEIGHT = new BigDecimal("1000");

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	private final ExerciseRepository exerciseRepository;

	private final TrainingPlanRepository planRepository;

	public ProgressionRecommendationService(WorkoutSessionRepository sessionRepository,
			WorkoutSetRepository setRepository, ExerciseRepository exerciseRepository,
			TrainingPlanRepository planRepository) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.exerciseRepository = exerciseRepository;
		this.planRepository = planRepository;
	}

	@Transactional(readOnly = true)
	public Optional<ProgressionRecommendationResponse> recommend(UUID userId, UUID exerciseId) {
		if (!exerciseRepository.existsById(exerciseId)) {
			throw new WorkoutNotFoundException("Exercise not found");
		}
		List<WorkoutSession> sessions = sessionRepository.findRecentEndedWithExercise(userId, exerciseId,
				PageRequest.of(0, REQUIRED_WORKOUTS));
		if (sessions.size() < REQUIRED_WORKOUTS) {
			return Optional.empty();
		}

		BigDecimal topWeight = null;
		TrainingPlanEntry latestTarget = null;
		for (WorkoutSession session : sessions) {
			Optional<TrainingPlanEntry> target = findTarget(userId, session, exerciseId);
			if (target.isEmpty()) {
				return Optional.empty();
			}
			List<WorkoutSet> sets = setRepository.findBySessionIdOrderByLoggedAtAsc(session.getId())
				.stream()
				.filter(set -> set.getExerciseId().equals(exerciseId))
				.toList();
			BigDecimal sessionTop = sets.stream()
				.map(WorkoutSet::getWeightKg)
				.max(Comparator.naturalOrder())
				.orElse(null);
			if (sessionTop == null || (topWeight != null && topWeight.compareTo(sessionTop) != 0)) {
				return Optional.empty();
			}
			topWeight = sessionTop;
			List<WorkoutSet> workingSets = sets.stream()
				.filter(set -> set.getWeightKg().compareTo(sessionTop) == 0)
				.toList();
			TrainingPlanEntry entry = target.get();
			if (workingSets.size() < entry.getSets()
					|| workingSets.stream().anyMatch(set -> set.getReps() < entry.getReps())) {
				return Optional.empty();
			}
			if (latestTarget == null) {
				latestTarget = entry;
			}
		}

		BigDecimal recommended = recommendedWeight(topWeight);
		if (recommended.compareTo(MAX_WEIGHT) > 0) {
			return Optional.empty();
		}
		return Optional.of(new ProgressionRecommendationResponse(exerciseId, topWeight, recommended,
				REQUIRED_WORKOUTS, latestTarget.getSets(), latestTarget.getReps()));
	}

	/** Target = the session plan's first entry (by position) for the exercise; none breaks the streak. */
	private Optional<TrainingPlanEntry> findTarget(UUID userId, WorkoutSession session, UUID exerciseId) {
		if (session.getPlanId() == null) {
			return Optional.empty();
		}
		return planRepository.findByIdAndUserId(session.getPlanId(), userId)
			.flatMap(plan -> plan.getEntries()
				.stream()
				.filter(entry -> entry.getExerciseId().equals(exerciseId))
				.min(Comparator.comparingInt(TrainingPlanEntry::getPosition)));
	}

	/** Top weight plus INCREASE, rounded half up to 0.5 kg, at least one 0.5 kg step above the top weight. */
	private BigDecimal recommendedWeight(BigDecimal topWeight) {
		BigDecimal rounded = topWeight.multiply(INCREASE)
			.multiply(BigDecimal.valueOf(2))
			.setScale(0, RoundingMode.HALF_UP)
			.divide(BigDecimal.valueOf(2))
			.setScale(1, RoundingMode.UNNECESSARY);
		return rounded.max(topWeight.add(MIN_STEP)).setScale(1, RoundingMode.UNNECESSARY);
	}

}
