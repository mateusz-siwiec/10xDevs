package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import java.util.UUID;
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
class WorkoutSessionControllerTest {

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

	private String bearerToken() {
		User user = userRepository.save(new User("sessions-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return com.jayway.jsonpath.JsonPath.read(body, "$.id");
	}

	@Test
	void routesWithoutTokenReturnUnauthorized() throws Exception {
		UUID id = UUID.randomUUID();
		mockMvc.perform(post("/api/workout-sessions")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/workout-sessions/current")).andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/workout-sessions/" + id + "/end")).andExpect(status().isUnauthorized());
	}

	@Test
	void startTwiceReturnsSameSessionCreatedThenOk() throws Exception {
		String token = bearerToken();

		String first = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id", notNullValue()))
			.andExpect(jsonPath("$.startedAt", notNullValue()))
			.andExpect(jsonPath("$.endedAt", nullValue()))
			.andExpect(jsonPath("$.sets", hasSize(0)))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String firstId = com.jayway.jsonpath.JsonPath.read(first, "$.id");

		mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(firstId)));
	}

	@Test
	void currentReturnsNoContentWhenNoActiveSession() throws Exception {
		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isNoContent());
	}

	@Test
	void currentReturnsActiveSession() throws Exception {
		String token = bearerToken();
		String id = startSession(token);

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(id)));
	}

	@Test
	void endSetsEndedAtAndSecondEndReturnsConflict() throws Exception {
		String token = bearerToken();
		String id = startSession(token);

		mockMvc.perform(post("/api/workout-sessions/" + id + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.endedAt", notNullValue()));

		mockMvc.perform(post("/api/workout-sessions/" + id + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.error", notNullValue()));

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());
	}

	@Test
	void endUnknownSessionReturnsNotFound() throws Exception {
		mockMvc.perform(post("/api/workout-sessions/" + UUID.randomUUID() + "/end")
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void otherUserCannotEndSession() throws Exception {
		String id = startSession(bearerToken());

		mockMvc.perform(post("/api/workout-sessions/" + id + "/end").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isNotFound());
	}

}
