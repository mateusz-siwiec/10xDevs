package com.example.gymtrack.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthControllerLoginTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void loginWithCorrectCredentialsReturnsTokenAndIdentity() throws Exception {
		userRepository.save(new User("login-success@example.com", passwordEncoder.encode("password123")));

		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"login-success@example.com\",\"password\":\"password123\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.token").isNotEmpty())
			.andExpect(jsonPath("$.id").exists())
			.andExpect(jsonPath("$.email").value("login-success@example.com"));
	}

	@Test
	void loginWithWrongPasswordReturnsUnauthorized() throws Exception {
		userRepository.save(new User("wrong-password@example.com", passwordEncoder.encode("password123")));

		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"wrong-password@example.com\",\"password\":\"not-the-password\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error").value("Invalid email or password"));
	}

	@Test
	void loginWithNonexistentEmailReturnsUnauthorizedWithSameErrorBody() throws Exception {
		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"nobody-here@example.com\",\"password\":\"password123\"}"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.error").value("Invalid email or password"));
	}

}
