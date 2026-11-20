package com.example.gymtrack.workout;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.exercise.Exercise;
import com.example.gymtrack.common.InvalidFieldException;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.exercise.Measure;
import com.example.gymtrack.exercise.WeightMode;
import com.example.gymtrack.plan.PlanNotFoundException;
import com.example.gymtrack.plan.TrainingPlanRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class WorkoutService {

	public record StartResult(SessionResponse session, boolean created) {
	}

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	private final ExerciseRepository exerciseRepository;

	private final TrainingPlanRepository planRepository;

	private final PersonalRecordService personalRecordService;

	private final TransactionTemplate transactionTemplate;

	public WorkoutService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			ExerciseRepository exerciseRepository, TrainingPlanRepository planRepository,
			PersonalRecordService personalRecordService, PlatformTransactionManager transactionManager) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.exerciseRepository = exerciseRepository;
		this.planRepository = planRepository;
		this.personalRecordService = personalRecordService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	/**
	 * Not itself transactional: a unique violation poisons the surrounding transaction, so each
	 * attempt runs in its own transaction and the re-read after a lost race runs in a fresh one.
	 */
	public StartResult startOrGetActive(UUID userId, UUID planId) {
		try {
			return transactionTemplate.execute(status -> {
				Optional<WorkoutSession> existing = sessionRepository.findByUserIdAndEndedAtIsNull(userId);
				if (existing.isPresent()) {
					if (planId != null && !planId.equals(existing.get().getPlanId())) {
						throw new WorkoutConflictException(ErrorCode.WORKOUT_ALREADY_ACTIVE, "A workout session is already active");
					}
					return new StartResult(toResponse(existing.get()), false);
				}
				if (planId != null && planRepository.findByIdAndUserId(planId, userId).isEmpty()) {
					throw new PlanNotFoundException("Training plan not found");
				}
				WorkoutSession created = sessionRepository.saveAndFlush(new WorkoutSession(userId, planId));
				return new StartResult(toResponse(created), true);
			});
		}
		catch (DataIntegrityViolationException ex) {
			// Lost the race against a concurrent start: the partial unique index arbitrated.
			return transactionTemplate.execute(status -> sessionRepository.findByUserIdAndEndedAtIsNull(userId)
				.map(session -> new StartResult(toResponse(session), false))
				.orElseThrow(() -> {
					// No active session either: the FK failed because the plan was deleted mid-start.
					if (planId != null && planRepository.findByIdAndUserId(planId, userId).isEmpty()) {
						return new PlanNotFoundException("Training plan not found");
					}
					return ex;
				}));
		}
	}

	@Transactional(readOnly = true)
	public Optional<SessionResponse> getActive(UUID userId) {
		return sessionRepository.findByUserIdAndEndedAtIsNull(userId).map(this::toResponse);
	}

	@Transactional
	public SessionResponse end(UUID userId, UUID sessionId) {
		WorkoutSession session = findOwned(userId, sessionId);
		if (!session.isActive()) {
			throw new WorkoutConflictException(ErrorCode.WORKOUT_ENDED, "Workout session already ended");
		}
		session.end();
		sessionRepository.saveAndFlush(session);
		return toResponse(session);
	}

	/** Removes the session; its sets go with it (ON DELETE CASCADE). Everything derived from sets is recomputed on read. */
	@Transactional
	public void delete(UUID userId, UUID sessionId) {
		sessionRepository.delete(findOwned(userId, sessionId));
		sessionRepository.flush();
	}

	@Transactional
	public SetResponse logSet(UUID userId, UUID sessionId, UUID exerciseId, Integer reps,
			Integer durationSeconds, BigDecimal weightKg, boolean toFailure) {
		WorkoutSession session = findOwned(userId, sessionId);
		Exercise exercise = exerciseRepository.findVisibleById(exerciseId, userId)
			.orElseThrow(() -> new WorkoutNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found"));
		if (!session.isActive()) {
			throw new WorkoutConflictException(ErrorCode.WORKOUT_ENDED, "Workout session already ended");
		}
		validateMeasure(exercise.getMeasure(), reps, durationSeconds);
		BigDecimal storedWeight = resolveWeight(exercise.getWeightMode(), weightKg);
		WorkoutSet set = setRepository.saveAndFlush(
				new WorkoutSet(session, exerciseId, reps, durationSeconds, storedWeight, toFailure));
		Set<UUID> personalRecordSetIds = personalRecordService.personalRecordSetIds(session,
				setRepository.findBySessionIdOrderByLoggedAtAscIdAsc(session.getId()));
		return SetResponse.from(set, personalRecordSetIds.contains(set.getId()));
	}

	/** REPS exercises need reps and reject a duration; DURATION exercises need a duration and reject reps. */
	private static void validateMeasure(Measure measure, Integer reps, Integer durationSeconds) {
		if (measure == Measure.DURATION) {
			if (durationSeconds == null) {
				throw new InvalidFieldException("durationSeconds is required for this exercise", "durationSeconds",
						"NotNull");
			}
			if (reps != null) {
				throw new InvalidFieldException("reps is not allowed for this exercise", "reps", "RepsNotAllowed");
			}
		}
		else {
			if (reps == null) {
				throw new InvalidFieldException("reps is required for this exercise", "reps", "NotNull");
			}
			if (durationSeconds != null) {
				throw new InvalidFieldException("durationSeconds is not allowed for this exercise",
						"durationSeconds", "DurationNotAllowed");
			}
		}
	}

	/** REQUIRED needs a positive weight, OPTIONAL treats a missing one as 0, NONE rejects a positive one and stores 0. */
	private static BigDecimal resolveWeight(WeightMode mode, BigDecimal weightKg) {
		boolean positive = weightKg != null && weightKg.signum() > 0;
		return switch (mode) {
			case REQUIRED -> {
				if (!positive) {
					throw new InvalidFieldException("weightKg is required for this exercise", "weightKg", "WeightRequired");
				}
				yield weightKg;
			}
			case OPTIONAL -> weightKg == null ? BigDecimal.ZERO : weightKg;
			case NONE -> {
				if (positive) {
					throw new InvalidFieldException("weightKg is not allowed for this exercise", "weightKg", "WeightNotAllowed");
				}
				yield BigDecimal.ZERO;
			}
		};
	}

	@Transactional
	public void deleteSet(UUID userId, UUID sessionId, UUID setId) {
		WorkoutSession session = findOwned(userId, sessionId);
		WorkoutSet set = setRepository.findByIdAndSessionId(setId, sessionId)
			.orElseThrow(() -> new WorkoutNotFoundException(ErrorCode.SET_NOT_FOUND, "Set not found"));
		if (!session.isActive()) {
			throw new WorkoutConflictException(ErrorCode.WORKOUT_ENDED, "Workout session already ended");
		}
		setRepository.delete(set);
	}

	@Transactional(readOnly = true)
	public List<ProgressionPointResponse> progression(UUID userId, UUID exerciseId) {
		Exercise exercise = exerciseRepository.findVisibleById(exerciseId, userId)
			.orElseThrow(() -> new WorkoutNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found"));
		List<ProgressionRow> rows = setRepository.findProgression(userId, exerciseId);
		if (exercise.getMeasure() == Measure.DURATION) {
			// Sessions that only hold rep sets logged before the exercise became timed have no duration to plot.
			return rows.stream()
				.filter(row -> row.topDurationSeconds() != null)
				.map(row -> new ProgressionPointResponse(row.sessionId(), row.date(), row.topWeightKg(),
						ProgressionPointResponse.Metric.DURATION, BigDecimal.valueOf(row.topDurationSeconds())))
				.toList();
		}
		boolean byReps = switch (exercise.getWeightMode()) {
			case REQUIRED -> false;
			case NONE -> true;
			case OPTIONAL -> rows.stream().noneMatch(row -> row.topWeightKg().signum() > 0);
		};
		return rows.stream()
			.filter(row -> !byReps || row.topReps() != null)
			.map(row -> byReps
				? new ProgressionPointResponse(row.sessionId(), row.date(), row.topWeightKg(),
						ProgressionPointResponse.Metric.REPS, BigDecimal.valueOf(row.topReps()))
				: new ProgressionPointResponse(row.sessionId(), row.date(), row.topWeightKg(),
						ProgressionPointResponse.Metric.WEIGHT, row.topWeightKg()))
			.toList();
	}

	private WorkoutSession findOwned(UUID userId, UUID sessionId) {
		return sessionRepository.findByIdAndUserId(sessionId, userId)
			.orElseThrow(() -> new WorkoutNotFoundException(ErrorCode.WORKOUT_NOT_FOUND, "Workout session not found"));
	}

	private SessionResponse toResponse(WorkoutSession session) {
		List<WorkoutSet> sets = setRepository.findBySessionIdOrderByLoggedAtAscIdAsc(session.getId());
		return SessionResponse.from(session, sets, personalRecordService.personalRecordSetIds(session, sets));
	}

}
