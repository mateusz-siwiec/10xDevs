package com.example.gymtrack.exercise;

import com.example.gymtrack.common.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ExerciseController {

	private final ExerciseRepository exerciseRepository;

	public ExerciseController(ExerciseRepository exerciseRepository) {
		this.exerciseRepository = exerciseRepository;
	}

	@GetMapping("/api/exercises")
	public List<ExerciseResponse> list(@RequestParam(required = false) MuscleGroup muscleGroup) {
		List<Exercise> exercises = muscleGroup == null
				? exerciseRepository.findAllByOrderByNameAsc()
				: exerciseRepository.findByPrimaryMuscleGroupOrderByNameAsc(muscleGroup);

		return exercises.stream().map(ExerciseResponse::from).toList();
	}

	@GetMapping("/api/exercises/{exerciseId}/substitutes")
	public List<ExerciseResponse> substitutes(@PathVariable UUID exerciseId) {
		Exercise exercise = exerciseRepository.findById(exerciseId)
				.orElseThrow(() -> new ResourceNotFoundException("Exercise not found"));

		return exerciseRepository
				.findByPrimaryMuscleGroupAndIdNotOrderByNameAsc(exercise.getPrimaryMuscleGroup(), exercise.getId())
				.stream()
				.map(ExerciseResponse::from)
				.toList();
	}

}
