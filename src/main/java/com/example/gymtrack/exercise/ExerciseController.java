package com.example.gymtrack.exercise;

import com.example.gymtrack.auth.CurrentUser;
import com.example.gymtrack.common.ResourceNotFoundException;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ExerciseController {

	private final ExerciseRepository exerciseRepository;

	private final ExerciseService exerciseService;

	public ExerciseController(ExerciseRepository exerciseRepository, ExerciseService exerciseService) {
		this.exerciseRepository = exerciseRepository;
		this.exerciseService = exerciseService;
	}

	@GetMapping("/api/exercises")
	public List<ExerciseResponse> list(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestParam(required = false) MuscleGroup muscleGroup) {
		return exerciseService.list(currentUser.id(), muscleGroup);
	}

	@PostMapping("/api/exercises")
	public ResponseEntity<ExerciseResponse> create(@AuthenticationPrincipal CurrentUser currentUser,
			@Valid @RequestBody CreateExerciseRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(exerciseService.create(currentUser.id(), request));
	}

	@DeleteMapping("/api/exercises/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		exerciseService.delete(currentUser.id(), id);
		return ResponseEntity.noContent().build();
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
