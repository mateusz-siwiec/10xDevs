package com.example.gymtrack.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class UserControllerMeTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	@Test
	void meWithValidTokenReturnsTheRegisteredUsersIdentity() throws Exception {
		User user = userRepository.save(new User("me-success@example.com", passwordEncoder.encode("password123")));
		String token = jwtService.generateToken(user.getId(), user.getEmail());

		mockMvc.perform(get("/api/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(user.getId().toString()))
			.andExpect(jsonPath("$.email").value("me-success@example.com"));
	}

	@Test
	void meWithNoAuthorizationHeaderReturnsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/users/me"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void meWithGarbageTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer garbage"))
			.andExpect(status().isUnauthorized());
	}

}
