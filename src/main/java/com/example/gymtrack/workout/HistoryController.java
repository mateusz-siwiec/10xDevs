package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HistoryController {

	private final HistoryService historyService;

	public HistoryController(HistoryService historyService) {
		this.historyService = historyService;
	}

	@GetMapping("/api/workout-sessions")
	public HistoryPageResponse list(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
			@RequestParam(required = false) UUID planId, @RequestParam(defaultValue = "false") boolean noPlan) {
		return historyService.list(currentUser.id(), page, size, planId, noPlan);
	}

	@GetMapping("/api/workout-sessions/{id}")
	public HistoryDetailResponse detail(@AuthenticationPrincipal CurrentUser currentUser, @PathVariable UUID id) {
		return historyService.detail(currentUser.id(), id);
	}

}
