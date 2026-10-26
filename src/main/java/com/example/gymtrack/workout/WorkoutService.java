package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.ExerciseRepository;
import java.math.BigDecimal;
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

	private final TransactionTemplate transactionTemplate;

	public WorkoutService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			ExerciseRepository exerciseRepository, PlatformTransactionManager transactionManager) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.exerciseRepository = exerciseRepository;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
	}

	/**
	 * Not itself transactional: a unique violation poisons the surrounding transaction, so each
	 * attempt runs in its own transaction and the re-read after a lost race runs in a fresh one.
	 */
	public StartResult startOrGetActive(UUID userId) {
		try {
			return transactionTemplate.execute(status -> {
				Optional<WorkoutSession> existing = sessionRepository.findByUserIdAndEndedAtIsNull(userId);
				if (existing.isPresent()) {
					return new StartResult(toResponse(existing.get()), false);
				}
				WorkoutSession created = sessionRepository.saveAndFlush(new WorkoutSession(userId));
				return new StartResult(toResponse(created), true);
			});
		}
		catch (DataIntegrityViolationException ex) {
			// Lost the race against a concurrent start: the partial unique index arbitrated.
			return transactionTemplate.execute(status -> sessionRepository.findByUserIdAndEndedAtIsNull(userId)
				.map(session -> new StartResult(toResponse(session), false))
				.orElseThrow(() -> ex));
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
		if (!exerciseRepository.existsById(exerciseId)) {
			throw new WorkoutNotFoundException("Exercise not found");
		}
		if (!session.isActive()) {
			throw new WorkoutConflictException("Workout session already ended");
		}
		if (weightKg.multiply(BigDecimal.TWO).remainder(BigDecimal.ONE).signum() != 0) {
			throw new InvalidWeightException("weightKg must be a multiple of 0.5");
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

	private WorkoutSession findOwned(UUID userId, UUID sessionId) {
		return sessionRepository.findByIdAndUserId(sessionId, userId)
			.orElseThrow(() -> new WorkoutNotFoundException("Workout session not found"));
	}

	private SessionResponse toResponse(WorkoutSession session) {
		return SessionResponse.from(session, setRepository.findBySessionIdOrderByLoggedAtAsc(session.getId()));
	}

}
