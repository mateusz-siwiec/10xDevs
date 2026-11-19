package com.example.gymtrack.exercise;

import com.example.gymtrack.common.ErrorCode;
import com.example.gymtrack.common.ResourceNotFoundException;
import com.example.gymtrack.plan.TrainingPlanRepository;
import com.example.gymtrack.workout.WorkoutSetRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExerciseService {

	private final ExerciseRepository exerciseRepository;

	private final TrainingPlanRepository planRepository;

	private final WorkoutSetRepository workoutSetRepository;

	private final FavoriteExerciseRepository favoriteRepository;

	public ExerciseService(ExerciseRepository exerciseRepository, TrainingPlanRepository planRepository,
			WorkoutSetRepository workoutSetRepository, FavoriteExerciseRepository favoriteRepository) {
		this.favoriteRepository = favoriteRepository;
		this.exerciseRepository = exerciseRepository;
		this.planRepository = planRepository;
		this.workoutSetRepository = workoutSetRepository;
	}

	@Transactional(readOnly = true)
	public List<ExerciseResponse> list(UUID userId, MuscleGroup muscleGroup) {
		List<Exercise> exercises = muscleGroup == null
				? exerciseRepository.findVisibleOrderByName(userId)
				: exerciseRepository.findVisibleByPrimaryMuscleGroupOrderByName(userId, muscleGroup);
		return toResponses(userId, exercises);
	}

	private List<ExerciseResponse> toResponses(UUID userId, List<Exercise> exercises) {
		Set<UUID> favorites = favoriteRepository.findExerciseIdsByUserId(userId);
		return exercises.stream().map((e) -> ExerciseResponse.from(e, favorites.contains(e.getId()))).toList();
	}

	@Transactional
	public void addFavorite(UUID userId, UUID exerciseId) {
		requireVisible(userId, exerciseId);
		favoriteRepository.addIfAbsent(userId, exerciseId);
	}

	@Transactional
	public void removeFavorite(UUID userId, UUID exerciseId) {
		requireVisible(userId, exerciseId);
		favoriteRepository.remove(userId, exerciseId);
	}

	private void requireVisible(UUID userId, UUID exerciseId) {
		if (!exerciseRepository.existsVisible(exerciseId, userId)) {
			throw new ResourceNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found");
		}
	}

	@Transactional(readOnly = true)
	public List<ExerciseResponse> substitutes(UUID userId, UUID exerciseId) {
		Exercise exercise = exerciseRepository.findVisibleById(exerciseId, userId)
				.orElseThrow(() -> new ResourceNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found"));
		return toResponses(userId,
				exerciseRepository.findVisibleSubstitutes(userId, exercise.getPrimaryMuscleGroup(), exercise.getId()));
	}

	@Transactional
	public ExerciseResponse create(UUID userId, CreateExerciseRequest request) {
		String name = request.name().trim();
		if (exerciseRepository.existsVisibleByName(name, userId)) {
			throw new ExerciseConflictException(ErrorCode.EXERCISE_NAME_TAKEN, "An exercise with this name already exists");
		}

		try {
			Exercise exercise = exerciseRepository.saveAndFlush(
					new Exercise(userId, name, request.primaryMuscleGroup(), request.secondaryMuscleGroups(),
							request.weightMode(), request.measure()));
			return ExerciseResponse.from(exercise, false);
		}
		catch (DataIntegrityViolationException e) {
			// A concurrent create with the same name won the race past the check above.
			throw new ExerciseConflictException(ErrorCode.EXERCISE_NAME_TAKEN, "An exercise with this name already exists");
		}
	}

	@Transactional
	public ExerciseResponse update(UUID userId, UUID id, CreateExerciseRequest request) {
		Exercise exercise = exerciseRepository.findByIdAndOwnerId(id, userId)
				.orElseThrow(() -> new ResourceNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found"));
		String name = request.name().trim();
		if (exerciseRepository.existsVisibleByNameExcludingId(name, userId, id)) {
			throw new ExerciseConflictException(ErrorCode.EXERCISE_NAME_TAKEN, "An exercise with this name already exists");
		}

		if (request.weightMode() != null && request.weightMode() != exercise.getWeightMode()
				&& workoutSetRepository.existsByExerciseId(id)) {
			throw new ExerciseConflictException(ErrorCode.EXERCISE_IN_USE,
					"Weight mode cannot be changed once sets are logged for this exercise");
		}

		if (request.measure() != null && request.measure() != exercise.getMeasure()
				&& workoutSetRepository.existsByExerciseId(id)) {
			throw new ExerciseConflictException(ErrorCode.EXERCISE_IN_USE,
					"Measure cannot be changed once sets are logged for this exercise");
		}

		try {
			exercise.update(name, request.primaryMuscleGroup(), request.secondaryMuscleGroups(),
					request.weightMode(), request.measure());
			Exercise saved = exerciseRepository.saveAndFlush(exercise);
			return ExerciseResponse.from(saved, favoriteRepository.findExerciseIdsByUserId(userId).contains(id));
		}
		catch (DataIntegrityViolationException e) {
			// A concurrent create/rename with the same name won the race past the check above.
			throw new ExerciseConflictException(ErrorCode.EXERCISE_NAME_TAKEN, "An exercise with this name already exists");
		}
	}

	@Transactional
	public void delete(UUID userId, UUID id) {
		Exercise exercise = exerciseRepository.findByIdAndOwnerId(id, userId)
				.orElseThrow(() -> new ResourceNotFoundException(ErrorCode.EXERCISE_NOT_FOUND, "Exercise not found"));

		if (planRepository.existsEntryByExerciseId(id) || workoutSetRepository.existsByExerciseId(id)) {
			throw new ExerciseConflictException(ErrorCode.EXERCISE_IN_USE, "Exercise is used in a plan or a workout");
		}

		try {
			exerciseRepository.delete(exercise);
			exerciseRepository.flush();
		}
		catch (DataIntegrityViolationException e) {
			// A plan entry or logged set referenced the exercise after the check above.
			throw new ExerciseConflictException(ErrorCode.EXERCISE_IN_USE, "Exercise is used in a plan or a workout");
		}
	}

}
