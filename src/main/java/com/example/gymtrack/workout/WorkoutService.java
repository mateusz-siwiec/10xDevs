package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.plan.PlanNotFoundException;
import com.example.gymtrack.plan.TrainingPlanRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
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

	private final TransactionTemplate transactionTemplate;

	public WorkoutService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			ExerciseRepository exerciseRepository, TrainingPlanRepository planRepository,
			PlatformTransactionManager transactionManager) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.exerciseRepository = exerciseRepository;
		this.planRepository = planRepository;
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
						throw new WorkoutConflictException("A workout session is already active");
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
			throw new WorkoutConflictException("Workout session already ended");
		}
		session.end();
		sessionRepository.saveAndFlush(session);
		return toResponse(session);
	}

	@Transactional
	public SetResponse logSet(UUID userId, UUID sessionId, UUID exerciseId, int reps, BigDecimal weightKg) {
		WorkoutSession session = findOwned(userId, sessionId);
		if (!exerciseRepository.existsVisible(exerciseId, userId)) {
			throw new WorkoutNotFoundException("Exercise not found");
		}
		if (!session.isActive()) {
			throw new WorkoutConflictException("Workout session already ended");
		}
		WorkoutSet set = setRepository.saveAndFlush(new WorkoutSet(session, exerciseId, reps, weightKg));
		return SetResponse.from(set);
	}

	@Transactional
	public void deleteSet(UUID userId, UUID sessionId, UUID setId) {
		WorkoutSession session = findOwned(userId, sessionId);
		WorkoutSet set = setRepository.findByIdAndSessionId(setId, sessionId)
			.orElseThrow(() -> new WorkoutNotFoundException("Set not found"));
		if (!session.isActive()) {
			throw new WorkoutConflictException("Workout session already ended");
		}
		setRepository.delete(set);
	}

	@Transactional(readOnly = true)
	public List<ProgressionPointResponse> progression(UUID userId, UUID exerciseId) {
		if (!exerciseRepository.existsVisible(exerciseId, userId)) {
			throw new WorkoutNotFoundException("Exercise not found");
		}
		return setRepository.findProgression(userId, exerciseId);
	}

	private WorkoutSession findOwned(UUID userId, UUID sessionId) {
		return sessionRepository.findByIdAndUserId(sessionId, userId)
			.orElseThrow(() -> new WorkoutNotFoundException("Workout session not found"));
	}

	private SessionResponse toResponse(WorkoutSession session) {
		return SessionResponse.from(session, setRepository.findBySessionIdOrderByLoggedAtAsc(session.getId()));
	}

}
