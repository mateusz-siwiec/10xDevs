package com.example.gymtrack.user;

import com.example.gymtrack.auth.CurrentUser;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

	@GetMapping("/api/users/me")
	public Map<String, Object> me(@AuthenticationPrincipal CurrentUser currentUser) {
		return Map.of("id", currentUser.id(), "email", currentUser.email());
	}

}
