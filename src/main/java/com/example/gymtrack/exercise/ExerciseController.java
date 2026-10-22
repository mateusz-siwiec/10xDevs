package com.example.gymtrack.exercise;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
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

}
