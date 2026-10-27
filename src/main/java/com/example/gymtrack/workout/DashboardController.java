package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

	private final DashboardService dashboardService;

	public DashboardController(DashboardService dashboardService) {
		this.dashboardService = dashboardService;
	}

	@GetMapping("/api/dashboard/stats")
	public DashboardStatsResponse stats(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestParam(defaultValue = "7") int days) {
		return dashboardService.stats(currentUser.id(), days);
	}

}
