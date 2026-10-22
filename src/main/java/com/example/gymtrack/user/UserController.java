package com.example.gymtrack.user;

import com.example.gymtrack.auth.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

	@GetMapping("/api/users/me")
	public UserResponse me(@AuthenticationPrincipal CurrentUser currentUser) {
		return new UserResponse(currentUser.id(), currentUser.email());
	}

}
