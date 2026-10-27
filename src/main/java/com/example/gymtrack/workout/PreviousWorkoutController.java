package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PreviousWorkoutController {

	private final PreviousWorkoutService previousWorkoutService;

	public PreviousWorkoutController(PreviousWorkoutService previousWorkoutService) {
		this.previousWorkoutService = previousWorkoutService;
	}

	@GetMapping("/api/exercises/{exerciseId}/previous-workout")
	public ResponseEntity<PreviousWorkoutResponse> previousWorkout(@AuthenticationPrincipal CurrentUser currentUser,
			@PathVariable UUID exerciseId, @RequestParam UUID planId) {
		return previousWorkoutService.find(currentUser.id(), exerciseId, planId)
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

}
