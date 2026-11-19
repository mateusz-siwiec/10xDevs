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
class ProgressionControllerTest {

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
		User user = userRepository.save(new User("progression-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID exerciseBySlug(String slug) {
		return exerciseRepository.findAllByOrderByNameAsc()
			.stream()
			.filter(exercise -> exercise.getSlug().equals(slug))
			.findFirst()
			.orElseThrow()
			.getId();
	}

	private UUID exerciseId() {
		return exerciseBySlug("barbell-bench-press");
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private String logSet(String token, String sessionId, UUID exerciseId, String weightKg) throws Exception {
		String body = "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":5,\"weightKg\":" + weightKg + "}";
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

	private String progressionUrl(UUID exerciseId) {
		return "/api/exercises/" + exerciseId + "/progression";
	}

	@Test
	void progressionWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(progressionUrl(UUID.randomUUID()))).andExpect(status().isUnauthorized());
	}

	@Test
	void progressionWithNoSetsReturnsEmptyArray() throws Exception {
		mockMvc.perform(get(progressionUrl(exerciseId())).header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void firstEverSetYieldsExactlyOnePoint() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();
		logSet(token, sessionId, exerciseId, "60");

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].sessionId", is(sessionId)))
			.andExpect(jsonPath("$[0].date", notNullValue()))
			.andExpect(jsonPath("$[0].topWeightKg", is(60.0)));
	}

	@Test
	void twoSetsInOneSessionYieldOnePointWithLargerWeight() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();
		logSet(token, sessionId, exerciseId, "50");
		logSet(token, sessionId, exerciseId, "62.5");

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].topWeightKg", is(62.5)));
	}

	@Test
	void twoSessionsYieldTwoPointsOldestFirst() throws Exception {
		String token = bearerToken();
		UUID exerciseId = exerciseId();
		String first = startSession(token);
		logSet(token, first, exerciseId, "70");
		endSession(token, first);
		String second = startSession(token);
		logSet(token, second, exerciseId, "55");

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].sessionId", is(first)))
			.andExpect(jsonPath("$[0].topWeightKg", is(70.0)))
			.andExpect(jsonPath("$[1].sessionId", is(second)))
			.andExpect(jsonPath("$[1].topWeightKg", is(55.0)));
	}

	@Test
	void otherUsersSetsNeverAppear() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		UUID exerciseId = exerciseId();
		logSet(tokenA, startSession(tokenA), exerciseId, "100");

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void deletingTopSetLowersThePoint() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();
		logSet(token, sessionId, exerciseId, "50");
		String topSetId = logSet(token, sessionId, exerciseId, "80");

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + topSetId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].topWeightKg", is(50.0)));
	}

	@Test
	void unknownExerciseReturnsNotFound() throws Exception {
		mockMvc.perform(get(progressionUrl(UUID.randomUUID())).header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("EXERCISE_NOT_FOUND")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	private void logBare(String token, String sessionId, UUID exerciseId, int reps, String weightKg) throws Exception {
		String weight = weightKg == null ? "" : ",\"weightKg\":" + weightKg;
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"exerciseId\":\"" + exerciseId + "\",\"reps\":" + reps + weight + "}"))
			.andExpect(status().isCreated());
	}

	@Test
	void requiredExerciseChartsWeightAsTheMetric() throws Exception {
		String token = bearerToken();
		UUID exerciseId = exerciseId();
		logSet(token, startSession(token), exerciseId, "60");

		mockMvc.perform(get(progressionUrl(exerciseId)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$[0].metric", is("WEIGHT")))
			.andExpect(jsonPath("$[0].value", is(60.0)))
			.andExpect(jsonPath("$[0].topWeightKg", is(60.0)));
	}

	@Test
	void noneExerciseChartsTopRepsAsTheMetric() throws Exception {
		String token = bearerToken();
		UUID rollout = exerciseBySlug("ab-wheel-rollout");
		String sessionId = startSession(token);
		logBare(token, sessionId, rollout, 8, null);
		logBare(token, sessionId, rollout, 12, null);

		mockMvc.perform(get(progressionUrl(rollout)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].metric", is("REPS")))
			.andExpect(jsonPath("$[0].value", is(12)))
			.andExpect(jsonPath("$[0].topWeightKg", is(0.0)));
	}

	@Test
	void optionalExerciseChartsRepsUntilAnyPositiveWeightAppears() throws Exception {
		String token = bearerToken();
		UUID pullUp = exerciseBySlug("pull-up");
		String first = startSession(token);
		logBare(token, first, pullUp, 9, null);
		endSession(token, first);

		mockMvc.perform(get(progressionUrl(pullUp)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$[0].metric", is("REPS")))
			.andExpect(jsonPath("$[0].value", is(9)));

		String second = startSession(token);
		logBare(token, second, pullUp, 5, "7.5");

		mockMvc.perform(get(progressionUrl(pullUp)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].metric", is("WEIGHT")))
			.andExpect(jsonPath("$[0].value", is(0.0)))
			.andExpect(jsonPath("$[1].metric", is("WEIGHT")))
			.andExpect(jsonPath("$[1].value", is(7.5)));
	}

	@Test
	void durationExerciseChartPlotsLongestSecondsPerSession() throws Exception {
		String token = bearerToken();
		UUID plank = exerciseBySlug("plank");
		String sessionId = startSession(token);
		for (int seconds : new int[] { 40, 75, 60 }) {
			mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
					.header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"exerciseId\":\"" + plank + "\",\"durationSeconds\":" + seconds + "}"))
				.andExpect(status().isCreated());
		}
		endSession(token, sessionId);

		mockMvc.perform(get(progressionUrl(plank)).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", org.hamcrest.Matchers.hasSize(1)))
			.andExpect(jsonPath("$[0].metric").value("DURATION"))
			.andExpect(jsonPath("$[0].value").value(75))
			.andExpect(jsonPath("$[0].topWeightKg").value(0.0));
	}

}
