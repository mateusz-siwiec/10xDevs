package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProgressionController {

	private final WorkoutService workoutService;

	private final ProgressionRecommendationService recommendationService;

	public ProgressionController(WorkoutService workoutService,
			ProgressionRecommendationService recommendationService) {
		this.workoutService = workoutService;
		this.recommendationService = recommendationService;
	}

	@GetMapping("/api/exercises/{exerciseId}/progression")
	public List<ProgressionPointResponse> progression(@AuthenticationPrincipal CurrentUser currentUser,
			@PathVariable UUID exerciseId) {
		return workoutService.progression(currentUser.id(), exerciseId);
	}

	@GetMapping("/api/exercises/{exerciseId}/progression-recommendation")
	public ResponseEntity<ProgressionRecommendationResponse> recommendation(
			@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID exerciseId) {
		return recommendationService.recommend(currentUser.id(), exerciseId)
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

}
