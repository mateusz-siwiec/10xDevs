package com.example.gymtrack.exercise;

import com.example.gymtrack.common.ResourceNotFoundException;
import com.example.gymtrack.plan.TrainingPlanRepository;
import com.example.gymtrack.workout.WorkoutSetRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExerciseService {

	private final ExerciseRepository exerciseRepository;

	private final TrainingPlanRepository planRepository;

	private final WorkoutSetRepository workoutSetRepository;

	public ExerciseService(ExerciseRepository exerciseRepository, TrainingPlanRepository planRepository,
			WorkoutSetRepository workoutSetRepository) {
		this.exerciseRepository = exerciseRepository;
		this.planRepository = planRepository;
		this.workoutSetRepository = workoutSetRepository;
	}

	@Transactional(readOnly = true)
	public List<ExerciseResponse> list(UUID userId, MuscleGroup muscleGroup) {
		List<Exercise> exercises = muscleGroup == null
				? exerciseRepository.findVisibleOrderByName(userId)
				: exerciseRepository.findVisibleByPrimaryMuscleGroupOrderByName(userId, muscleGroup);
		return exercises.stream().map(ExerciseResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public List<ExerciseResponse> substitutes(UUID userId, UUID exerciseId) {
		Exercise exercise = exerciseRepository.findVisibleById(exerciseId, userId)
				.orElseThrow(() -> new ResourceNotFoundException("Exercise not found"));
		return exerciseRepository.findVisibleSubstitutes(userId, exercise.getPrimaryMuscleGroup(), exercise.getId())
				.stream()
				.map(ExerciseResponse::from)
				.toList();
	}

	@Transactional
	public ExerciseResponse create(UUID userId, CreateExerciseRequest request) {
		String name = request.name().trim();
		if (exerciseRepository.existsVisibleByName(name, userId)) {
			throw new ExerciseConflictException("An exercise with this name already exists");
		}

		try {
			Exercise exercise = exerciseRepository.saveAndFlush(
					new Exercise(userId, name, request.primaryMuscleGroup(), request.secondaryMuscleGroups()));
			return ExerciseResponse.from(exercise);
		}
		catch (DataIntegrityViolationException e) {
			// A concurrent create with the same name won the race past the check above.
			throw new ExerciseConflictException("An exercise with this name already exists");
		}
	}

	@Transactional
	public void delete(UUID userId, UUID id) {
		Exercise exercise = exerciseRepository.findByIdAndOwnerId(id, userId)
				.orElseThrow(() -> new ResourceNotFoundException("Exercise not found"));

		if (planRepository.existsEntryByExerciseId(id) || workoutSetRepository.existsByExerciseId(id)) {
			throw new ExerciseConflictException("Exercise is used in a plan or a workout");
		}

		try {
			exerciseRepository.delete(exercise);
			exerciseRepository.flush();
		}
		catch (DataIntegrityViolationException e) {
			// A plan entry or logged set referenced the exercise after the check above.
			throw new ExerciseConflictException("Exercise is used in a plan or a workout");
		}
	}

}
