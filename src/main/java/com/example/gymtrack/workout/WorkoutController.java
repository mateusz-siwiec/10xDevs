package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class WorkoutController {

	private final WorkoutService workoutService;

	public WorkoutController(WorkoutService workoutService) {
		this.workoutService = workoutService;
	}

	@PostMapping("/api/workout-sessions")
	public ResponseEntity<SessionResponse> start(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestBody(required = false) StartSessionRequest request) {
		UUID planId = request == null ? null : request.planId();
		WorkoutService.StartResult result = workoutService.startOrGetActive(currentUser.id(), planId);
		return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.session());
	}

	@GetMapping("/api/workout-sessions/current")
	public ResponseEntity<SessionResponse> current(@AuthenticationPrincipal CurrentUser currentUser) {
		return workoutService.getActive(currentUser.id())
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@PostMapping("/api/workout-sessions/{id}/end")
	public SessionResponse end(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		return workoutService.end(currentUser.id(), id);
	}

	@DeleteMapping("/api/workout-sessions/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		workoutService.delete(currentUser.id(), id);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/api/workout-sessions/{id}/sets")
	public ResponseEntity<SetResponse> logSet(@AuthenticationPrincipal CurrentUser currentUser,
			@PathVariable UUID id, @Valid @RequestBody LogSetRequest request) {
		SetResponse set = workoutService.logSet(currentUser.id(), id, request.exerciseId(), request.reps(),
				request.weightKg());
		return ResponseEntity.status(HttpStatus.CREATED).body(set);
	}

	@DeleteMapping("/api/workout-sessions/{id}/sets/{setId}")
	public ResponseEntity<Void> deleteSet(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id,
			@PathVariable UUID setId) {
		workoutService.deleteSet(currentUser.id(), id, setId);
		return ResponseEntity.noContent().build();
	}

}
