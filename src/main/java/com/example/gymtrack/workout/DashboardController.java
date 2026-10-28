package com.example.gymtrack.workout;

import com.example.gymtrack.auth.CurrentUser;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
			@RequestParam(defaultValue = "7") String days) {
		return dashboardService.stats(currentUser.id(), days);
	}

	@GetMapping("/api/dashboard/insights")
	public DashboardInsightsResponse insights(@AuthenticationPrincipal CurrentUser currentUser) {
		return dashboardService.insights(currentUser.id());
	}

	/**
	 * The body is read as a plain map so non-integer values (2.5, "abc") reach the service's
	 * validation and come back as 400 instead of a deserialization error; a missing key is rejected.
	 */
	@PutMapping("/api/dashboard/weekly-goal")
	public WeeklyGoalResponse setWeeklyGoal(@AuthenticationPrincipal CurrentUser currentUser,
			@RequestBody Map<String, Object> body) {
		if (!body.containsKey("weeklyGoal")) {
			throw new InvalidWeeklyGoalException("weeklyGoal is required (1-14 or null)");
		}
		return new WeeklyGoalResponse(dashboardService.setWeeklyGoal(currentUser.id(), body.get("weeklyGoal")));
	}

}
