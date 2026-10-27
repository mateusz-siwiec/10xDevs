package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
class PersonalRecordControllerTest {

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
		User user = userRepository.save(new User("pr-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID exerciseId() {
		return exerciseRepository.findAllByOrderByNameAsc().get(0).getId();
	}

	private UUID otherExerciseId() {
		return exerciseRepository.findAllByOrderByNameAsc().get(1).getId();
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private void endSession(String token, String sessionId) throws Exception {
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
	}

	private String setBody(UUID exerciseId, int reps, String weightKg) {
		return "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":" + reps + ",\"weightKg\":" + weightKg + "}";
	}

	/** Logs a set and returns the created set's JSON response. */
	private String logSet(String token, String sessionId, UUID exerciseId, int reps, String weightKg)
			throws Exception {
		return mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(setBody(exerciseId, reps, weightKg)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
	}

	private boolean logSetFlag(String token, String sessionId, UUID exerciseId, int reps, String weightKg)
			throws Exception {
		return JsonPath.read(logSet(token, sessionId, exerciseId, reps, weightKg), "$.personalRecord");
	}

	private String setId(String setJson) {
		return JsonPath.read(setJson, "$.id");
	}

	@Test
	void firstSetIsNotFlaggedAndLaterHigherScoreIs() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		assertFalse(logSetFlag(token, sessionId, exerciseId, 3, "60"));
		assertTrue(logSetFlag(token, sessionId, exerciseId, 5, "60"));

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.sets[0].personalRecord", is(false)))
			.andExpect(jsonPath("$.sets[1].personalRecord", is(true)));
	}

	@Test
	void tieIsNotFlagged() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		assertFalse(logSetFlag(token, sessionId, exerciseId, 5, "60"));
		assertFalse(logSetFlag(token, sessionId, exerciseId, 5, "60"));
	}

	@Test
	void setsAboveFifteenRepsAreIgnoredAndDoNotRaiseBaseline() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		assertFalse(logSetFlag(token, sessionId, exerciseId, 5, "60"));
		// Score 60 x 50 = 3000 beats 60 x 35 = 2100, yet 20 reps is ineligible.
		assertFalse(logSetFlag(token, sessionId, exerciseId, 20, "60"));
		// Would not beat the 20-rep score (60 x 36 = 2160 < 3000) if it had raised the baseline.
		assertTrue(logSetFlag(token, sessionId, exerciseId, 6, "60"));
	}

	@Test
	void fifteenRepsIsTheLastEligibleCount() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		assertFalse(logSetFlag(token, sessionId, exerciseId, 5, "60"));
		assertFalse(logSetFlag(token, sessionId, exerciseId, 16, "60"));
		// 60 x 45 = 2700 beats 60 x 35 = 2100; the 16-rep set (2760) never entered the baseline.
		assertTrue(logSetFlag(token, sessionId, exerciseId, 15, "60"));
	}

	@Test
	void baselineSpansSessionsAndIgnoresOtherUsers() throws Exception {
		String token = bearerToken();
		String otherToken = bearerToken();
		UUID exerciseId = exerciseId();

		String otherSession = startSession(otherToken);
		logSet(otherToken, otherSession, exerciseId, 5, "200");
		endSession(otherToken, otherSession);

		String first = startSession(token);
		logSet(token, first, exerciseId, 5, "60");
		endSession(token, first);

		String second = startSession(token);
		assertFalse(logSetFlag(token, second, exerciseId, 5, "60"));
		assertTrue(logSetFlag(token, second, exerciseId, 5, "65"));
	}

	@Test
	void differentExercisesHaveIndependentBaselines() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);

		assertFalse(logSetFlag(token, sessionId, exerciseId(), 5, "100"));
		// First set of its own exercise, so no flag even though it is lighter than the first exercise's set.
		assertFalse(logSetFlag(token, sessionId, otherExerciseId(), 5, "20"));
		assertTrue(logSetFlag(token, sessionId, otherExerciseId(), 5, "22.5"));
	}

	@Test
	void logResponseCurrentAndHistoryDetailReportIdenticalFlags() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		boolean[] logged = {
			logSetFlag(token, sessionId, exerciseId, 5, "60"),
			logSetFlag(token, sessionId, exerciseId, 5, "65"),
			logSetFlag(token, sessionId, exerciseId, 5, "62.5"),
			logSetFlag(token, sessionId, exerciseId, 20, "100"),
			logSetFlag(token, sessionId, exerciseId, 5, "70"),
		};
		assertArrayEquals(new boolean[] { false, true, false, false, true },
				logged);

		var current = mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
		for (int i = 0; i < logged.length; i++) {
			current.andExpect(jsonPath("$.sets[" + i + "].personalRecord", is(logged[i])));
		}

		endSession(token, sessionId);
		var detail = mockMvc.perform(get("/api/workout-sessions/" + sessionId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
		for (int i = 0; i < logged.length; i++) {
			detail.andExpect(jsonPath("$.exercises[0].sets[" + i + "].personalRecord", is(logged[i])));
		}
	}

	@Test
	void deletingAFlaggedSetReevaluatesTheRemainingSets() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		UUID exerciseId = exerciseId();

		logSet(token, sessionId, exerciseId, 5, "60");
		String flagged = logSet(token, sessionId, exerciseId, 5, "65");
		assertTrue(JsonPath.<Boolean>read(flagged, "$.personalRecord"));
		logSet(token, sessionId, exerciseId, 5, "62.5");

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.sets[2].personalRecord", is(false)));

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId + "/sets/" + setId(flagged))
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/workout-sessions/current").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.sets[0].personalRecord", is(false)))
			.andExpect(jsonPath("$.sets[1].personalRecord", is(true)));
	}

}
