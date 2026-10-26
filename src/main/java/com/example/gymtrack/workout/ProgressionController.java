package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressionController {

	private final WorkoutService workoutService;

	public ProgressionController(WorkoutService workoutService) {
		this.workoutService = workoutService;
	}

	@GetMapping("/api/exercises/{exerciseId}/progression")
	public List<ProgressionPointResponse> progression(@AuthenticationPrincipal CurrentUser currentUser,
			@PathVariable UUID exerciseId) {
		return workoutService.progression(currentUser.id(), exerciseId);
	}

}
