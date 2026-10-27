package com.example.gymtrack.workout;

import com.example.gymtrack.exercise.ExerciseRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The sets of the user's most recent ended session of a plan that contains the exercise. */
@Service
public class PreviousWorkoutService {

	private final WorkoutSessionRepository sessionRepository;

	private final WorkoutSetRepository setRepository;

	private final ExerciseRepository exerciseRepository;

	public PreviousWorkoutService(WorkoutSessionRepository sessionRepository, WorkoutSetRepository setRepository,
			ExerciseRepository exerciseRepository) {
		this.sessionRepository = sessionRepository;
		this.setRepository = setRepository;
		this.exerciseRepository = exerciseRepository;
	}

	@Transactional(readOnly = true)
	public Optional<PreviousWorkoutResponse> find(UUID userId, UUID exerciseId, UUID planId) {
		if (!exerciseRepository.existsById(exerciseId)) {
			throw new WorkoutNotFoundException("Exercise not found");
		}
		return sessionRepository.findRecentEndedInPlanWithExercise(userId, planId, exerciseId, PageRequest.of(0, 1))
			.stream()
			.findFirst()
			.map(session -> {
				List<PreviousWorkoutResponse.SetEntry> sets = setRepository
					.findBySessionIdOrderByLoggedAtAsc(session.getId())
					.stream()
					.filter(set -> set.getExerciseId().equals(exerciseId))
					.map(set -> new PreviousWorkoutResponse.SetEntry(set.getReps(), set.getWeightKg()))
					.toList();
				return new PreviousWorkoutResponse(exerciseId, session.getId(), session.getEndedAt(), sets);
			});
	}

}
