package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
class WorkoutSetControllerTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private ExerciseRepository exerciseRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	private String bearerToken() {
		User user = userRepository.save(new User("sets-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID exerciseId() {
		return exerciseRepository.findAllByOrderByNameAsc().get(0).getId();
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private String setBody(Object exerciseId, int reps, String weightKg) {
		return "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":" + reps + ",\"weightKg\":" + weightKg + "}";
	}

	private String logSet(String token, String sessionId, String body) throws Exception {
		String response = mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(response, "$.id");
	}

	private void endSession(String token, String sessionId) throws Exception {
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
	}

	@Test
	void setRoutesWithoutTokenReturnUnauthorized() throws Exception {
		UUID id = UUID.randomUUID();
		mockMvc.perform(post("/api/workout-sessions/" + id + "/sets")
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(id, 5, "60")))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/workout-sessions/" + id + "/sets/" + id)).andExpect(status().isUnauthorized());
	}

	@Test
	void logSetReturnsCreatedAndAppearsInCurrentSession() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(exerciseId, 8, "62.5")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id", notNullValue()))
			.andExpect(jsonPath("$.exerciseId", is(exerciseId.toString())))
			.andExpect(jsonPath("$.reps", is(8)))
			.andExpect(jsonPath("$.weightKg", is(62.5)))
			.andExpect(jsonPath("$.loggedAt", notNullValue()));

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sets", hasSize(1)));
	}

	@Test
	void logSetWithInvalidValuesReturnsBadRequest() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		String[] badBodies = {
			setBody(exerciseId, 0, "60"),
			setBody(exerciseId, 101, "60"),
			setBody(exerciseId, 5, "0"),
			setBody(exerciseId, 5, "-5"),
			setBody(exerciseId, 5, "1000.5"),
			setBody(exerciseId, 5, "60.3"),
			"{\"reps\":5,\"weightKg\":60}",
		};
		for (String body : badBodies) {
			mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
					.header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
				.andExpect(jsonPath("$.error", notNullValue()));
		}
	}

	@Test
	void logSetWithUnknownExerciseReturnsNotFound() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);

		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(UUID.randomUUID(), 5, "60")))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("EXERCISE_NOT_FOUND")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void logSetOnEndedSessionReturnsConflict() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		endSession(token, sessionId);

		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(exerciseId(), 5, "60")))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("WORKOUT_ENDED")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void otherUserGetsNotFoundOnLogAndDelete() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		String sessionId = startSession(tokenA);
		String setId = logSet(tokenA, sessionId, setBody(exerciseId(), 5, "60"));

		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, tokenB)
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(exerciseId(), 5, "60")))
			.andExpect(status().isNotFound());

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + setId)
				.header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isNotFound());
	}

	@Test
	void deleteSetRemovesItAndUnknownSetReturnsNotFound() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		String setId = logSet(token, sessionId, setBody(exerciseId(), 5, "60"));

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + setId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.sets", hasSize(0)));

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + setId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("SET_NOT_FOUND")));
	}

	@Test
	void deleteSetOnEndedSessionReturnsConflict() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		String setId = logSet(token, sessionId, setBody(exerciseId(), 5, "60"));
		endSession(token, sessionId);

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + setId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isConflict());
	}

}
