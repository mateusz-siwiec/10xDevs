package com.example.gymtrack.plan;

import com.example.gymtrack.auth.CurrentUser;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TrainingPlanController {

	private final TrainingPlanService planService;

	public TrainingPlanController(TrainingPlanService planService) {
		this.planService = planService;
	}

	@GetMapping("/api/training-plans")
	public List<PlanSummaryResponse> list(@AuthenticationPrincipal CurrentUser currentUser) {
		return planService.list(currentUser.id());
	}

	@GetMapping("/api/training-plans/{id}")
	public PlanResponse get(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		return planService.get(currentUser.id(), id);
	}

	@PostMapping("/api/training-plans")
	public ResponseEntity<PlanResponse> create(@AuthenticationPrincipal CurrentUser currentUser,
			@Valid @RequestBody PlanRequest request) {
		PlanResponse plan = planService.create(currentUser.id(), request.name(), request.exerciseIds());
		return ResponseEntity.status(HttpStatus.CREATED).body(plan);
	}

	@PutMapping("/api/training-plans/{id}")
	public PlanResponse replace(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id,
			@Valid @RequestBody PlanRequest request) {
		return planService.replace(currentUser.id(), id, request.name(), request.exerciseIds());
	}

	@DeleteMapping("/api/training-plans/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		planService.delete(currentUser.id(), id);
		return ResponseEntity.noContent().build();
	}

}
