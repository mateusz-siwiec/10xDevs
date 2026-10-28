package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
class DashboardControllerTest {

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

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private String bearerToken() {
		User user = userRepository.save(new User("dashboard-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private void logSet(String token, String sessionId, int reps, String weightKg) throws Exception {
		UUID exerciseId = exerciseRepository.findAllByOrderByNameAsc().get(0).getId();
		String body = "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":" + reps + ",\"weightKg\":" + weightKg + "}";
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body))
			.andExpect(status().isCreated());
	}

	private void endSession(String token, String sessionId) throws Exception {
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
	}

	/** end() stamps Instant.now(), so tests pin the session's time range directly. */
	private void setTimes(String sessionId, Instant startedAt, Instant endedAt) {
		jdbcTemplate.update("update workout_sessions set started_at = ?, ended_at = ? where id = ?",
				OffsetDateTime.ofInstant(startedAt, ZoneOffset.UTC), OffsetDateTime.ofInstant(endedAt, ZoneOffset.UTC),
				UUID.fromString(sessionId));
	}

	/** One ended session: 5x100 + 3x50 = 650 kg volume, lasting exactly 3600 seconds, ended daysAgo days ago. */
	private void endedSession(String token, int daysAgo) throws Exception {
		String sessionId = startSession(token);
		logSet(token, sessionId, 5, "100");
		logSet(token, sessionId, 3, "50");
		endSession(token, sessionId);
		Instant endedAt = Instant.now().minus(daysAgo, ChronoUnit.DAYS);
		setTimes(sessionId, endedAt.minusSeconds(3600), endedAt);
	}

	/** Same session shape as endedSession, but ended at an arbitrary offset before now. */
	private void endedSessionAgo(String token, java.time.Duration ago) throws Exception {
		String sessionId = startSession(token);
		logSet(token, sessionId, 5, "100");
		logSet(token, sessionId, 3, "50");
		endSession(token, sessionId);
		Instant endedAt = Instant.now().minus(ago);
		setTimes(sessionId, endedAt.minusSeconds(3600), endedAt);
	}

	@Test
	void sessionInPreviousWindowAppearsOnlyInPrevious() throws Exception {
		String token = bearerToken();
		endedSession(token, 10);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.totalVolumeKg", is(0)))
			.andExpect(jsonPath("$.previous.workoutCount", is(1)))
			.andExpect(jsonPath("$.previous.totalDurationSeconds", is(3600)))
			.andExpect(jsonPath("$.previous.totalVolumeKg", closeTo(650.0, 0.001)));
	}

	@Test
	void emptyUserGetsZeroPreviousTotals() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.previous.workoutCount", is(0)))
			.andExpect(jsonPath("$.previous.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.previous.totalVolumeKg", is(0)));
	}

	/**
	 * Windows are half-open [now-N, now) and [now-2N, now-N). Sessions are pinned one minute on either side of
	 * the edge so the few ms of drift between setup and request cannot flip the result.
	 */
	@Test
	void windowEdgeSplitsCurrentFromPrevious() throws Exception {
		String token = bearerToken();
		endedSessionAgo(token, java.time.Duration.ofDays(7).minusMinutes(1));
		endedSessionAgo(token, java.time.Duration.ofDays(7).plusMinutes(1));

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.workoutCount", is(1)))
			.andExpect(jsonPath("$.previous.workoutCount", is(1)));
	}

	@Test
	void sessionBeyondTwoWindowsIsInNeitherCurrentNorPrevious() throws Exception {
		String token = bearerToken();
		endedSession(token, 20);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.previous.workoutCount", is(0)));
	}

	@Test
	void ninetyDayWindowIncludesOlderSessionsAndPrevious() throws Exception {
		String token = bearerToken();
		endedSession(token, 60);
		endedSession(token, 120);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "90").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days", is(90)))
			.andExpect(jsonPath("$.workoutCount", is(1)))
			.andExpect(jsonPath("$.totalVolumeKg", closeTo(650.0, 0.001)))
			.andExpect(jsonPath("$.previous.workoutCount", is(1)));
	}

	@Test
	void allWindowIncludesOldSessionsWithNullDaysAndPrevious() throws Exception {
		String token = bearerToken();
		endedSession(token, 1);
		endedSession(token, 400);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "all").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days").value(org.hamcrest.Matchers.nullValue()))
			.andExpect(jsonPath("$.workoutCount", is(2)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(7200)))
			.andExpect(jsonPath("$.totalVolumeKg", closeTo(1300.0, 0.001)))
			.andExpect(jsonPath("$.previous").value(org.hamcrest.Matchers.nullValue()));
	}

	@Test
	void otherUsersPreviousWindowNeverLeaks() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		endedSession(tokenA, 10);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.previous.workoutCount", is(0)))
			.andExpect(jsonPath("$.previous.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.previous.totalVolumeKg", is(0)));
	}

	@Test
	void uppercaseAllIsRejected() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").param("days", "ALL").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void statsWithoutTokenReturnsUnauthorized()throws Exception {
		mockMvc.perform(get("/api/dashboard/stats")).andExpect(status().isUnauthorized());
	}

	@Test
	void emptyUserGetsZeros() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days", is(7)))
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.totalVolumeKg", is(0)));
	}

	@Test
	void endedSessionYieldsExactCountVolumeAndDuration() throws Exception {
		String token = bearerToken();
		endedSession(token, 1);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days", is(7)))
			.andExpect(jsonPath("$.workoutCount", is(1)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(3600)))
			.andExpect(jsonPath("$.totalVolumeKg", closeTo(650.0, 0.001)));
	}

	@Test
	void activeSessionIsExcludedFromAllMetrics() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		logSet(token, sessionId, 5, "100");

		mockMvc.perform(get("/api/dashboard/stats").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.totalVolumeKg", is(0)));
	}

	@Test
	void sessionOutsideWindowIsExcludedForSevenDaysButIncludedForThirty() throws Exception {
		String token = bearerToken();
		endedSession(token, 10);

		mockMvc.perform(get("/api/dashboard/stats").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.totalVolumeKg", is(0)));

		mockMvc.perform(get("/api/dashboard/stats").param("days", "30").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.days", is(30)))
			.andExpect(jsonPath("$.workoutCount", is(1)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(3600)))
			.andExpect(jsonPath("$.totalVolumeKg", closeTo(650.0, 0.001)));
	}

	@Test
	void otherUsersDataNeverLeaks() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		endedSession(tokenA, 1);

		mockMvc.perform(get("/api/dashboard/stats").header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.workoutCount", is(0)))
			.andExpect(jsonPath("$.totalDurationSeconds", is(0)))
			.andExpect(jsonPath("$.totalVolumeKg", is(0)));
	}

	@Test
	void unsupportedWindowReturnsBadRequest() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").param("days", "14").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void zeroDaysReturnsBadRequest() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").param("days", "0").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void nonNumericDaysReturnsBadRequest() throws Exception {
		mockMvc.perform(get("/api/dashboard/stats").param("days", "abc").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

}
