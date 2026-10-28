package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class DashboardInsightsControllerTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	private static final Duration WEEK = Duration.ofDays(7);

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

	/** One logged set: reps x weightKg of the exercise. */
	private record S(UUID exerciseId, int reps, String weightKg) {
	}

	private String bearerToken() {
		User user = userRepository.save(new User("insights-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID exerciseA() {
		return exerciseRepository.findAllByOrderByNameAsc().get(0).getId();
	}

	private UUID exerciseB() {
		return exerciseRepository.findAllByOrderByNameAsc().get(1).getId();
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private String logSet(String token, String sessionId, S set) throws Exception {
		String body = "{\"exerciseId\":\"" + set.exerciseId() + "\",\"reps\":" + set.reps() + ",\"weightKg\":"
				+ set.weightKg() + "}";
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

	/**
	 * Ends a session that finished {@code ago} before now, lasting an hour. Each set's loggedAt is pinned
	 * inside the session, one minute apart, so the cross-session record scan sees the intended order.
	 */
	private String endedSession(String token, Duration ago, S... sets) throws Exception {
		String sessionId = startSession(token);
		String[] setIds = new String[sets.length];
		for (int i = 0; i < sets.length; i++) {
			setIds[i] = logSet(token, sessionId, sets[i]);
		}
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
		Instant endedAt = Instant.now().minus(ago);
		Instant startedAt = endedAt.minusSeconds(3600);
		jdbcTemplate.update("update workout_sessions set started_at = ?, ended_at = ? where id = ?",
				OffsetDateTime.ofInstant(startedAt, ZoneOffset.UTC), OffsetDateTime.ofInstant(endedAt, ZoneOffset.UTC),
				UUID.fromString(sessionId));
		for (int i = 0; i < setIds.length; i++) {
			jdbcTemplate.update("update workout_sets set logged_at = ? where id = ?",
					OffsetDateTime.ofInstant(startedAt.plusSeconds(60L * (i + 1)), ZoneOffset.UTC),
					UUID.fromString(setIds[i]));
		}
		return sessionId;
	}

	/** {@code count} ended sessions in week block k, each well inside the block (middle of the week). */
	private void sessionsInBlock(String token, int k, int count) throws Exception {
		for (int i = 0; i < count; i++) {
			endedSession(token, WEEK.multipliedBy(k).plusDays(3).plusHours(i), new S(exerciseA(), 5, "100"));
		}
	}

	private ResultActions insights(String token) throws Exception {
		return mockMvc.perform(get("/api/dashboard/insights").header(HttpHeaders.AUTHORIZATION, token));
	}

	private ResultActions putGoal(String token, String body) throws Exception {
		return mockMvc.perform(put("/api/dashboard/weekly-goal").header(HttpHeaders.AUTHORIZATION, token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(body));
	}

	@Test
	void emptyUserGetsTwelveZeroFilledWeeksAndNoStreak() throws Exception {
		insights(bearerToken()).andExpect(status().isOk())
			.andExpect(jsonPath("$.weeklyVolume", hasSize(12)))
			.andExpect(jsonPath("$.weeklyVolume[0].workoutCount", is(0)))
			.andExpect(jsonPath("$.weeklyVolume[0].volumeKg", is(0)))
			.andExpect(jsonPath("$.weeklyVolume[11].workoutCount", is(0)))
			.andExpect(jsonPath("$.streak.goal", nullValue()))
			.andExpect(jsonPath("$.streak.weeks", is(0)))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(0)))
			.andExpect(jsonPath("$.recentPersonalRecords", hasSize(0)));
	}

	@Test
	void sessionsSixAndEightDaysAgoLandInBlocksZeroAndOne() throws Exception {
		String token = bearerToken();
		endedSession(token, Duration.ofDays(6), new S(exerciseA(), 5, "100"));
		endedSession(token, Duration.ofDays(8), new S(exerciseA(), 3, "50"), new S(exerciseA(), 2, "50"));

		insights(token).andExpect(status().isOk())
			.andExpect(jsonPath("$.weeklyVolume", hasSize(12)))
			.andExpect(jsonPath("$.weeklyVolume[11].workoutCount", is(1)))
			.andExpect(jsonPath("$.weeklyVolume[11].volumeKg", closeTo(500.0, 0.001)))
			.andExpect(jsonPath("$.weeklyVolume[10].workoutCount", is(1)))
			.andExpect(jsonPath("$.weeklyVolume[10].volumeKg", closeTo(250.0, 0.001)))
			.andExpect(jsonPath("$.weeklyVolume[9].workoutCount", is(0)))
			.andExpect(jsonPath("$.weeklyVolume[9].volumeKg", is(0)))
			.andExpect(jsonPath("$.weeklyVolume[0].workoutCount", is(0)))
			.andExpect(jsonPath("$.weeklyVolume[11].weekStart", notNullValue()))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(1)));
	}

	@Test
	void sessionOlderThanTwelveWeeksIsNotInTheBlocks() throws Exception {
		String token = bearerToken();
		endedSession(token, Duration.ofDays(12 * 7 + 3), new S(exerciseA(), 5, "100"));

		insights(token).andExpect(status().isOk())
			.andExpect(jsonPath("$.weeklyVolume[?(@.workoutCount > 0)]", hasSize(0)));
	}

	@Test
	void streakCountsFullWeeksBeforeCurrentWhenCurrentMissesGoal() throws Exception {
		String token = bearerToken();
		putGoal(token, "{\"weeklyGoal\":3}").andExpect(status().isOk());
		sessionsInBlock(token, 0, 1);
		sessionsInBlock(token, 1, 3);
		sessionsInBlock(token, 2, 4);
		sessionsInBlock(token, 3, 2);

		insights(token).andExpect(status().isOk())
			.andExpect(jsonPath("$.streak.goal", is(3)))
			.andExpect(jsonPath("$.streak.weeks", is(2)))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(1)));
	}

	@Test
	void streakAddsCurrentWeekWhenItMeetsGoal() throws Exception {
		String token = bearerToken();
		putGoal(token, "{\"weeklyGoal\":3}").andExpect(status().isOk());
		sessionsInBlock(token, 0, 3);
		sessionsInBlock(token, 1, 3);
		sessionsInBlock(token, 2, 4);
		sessionsInBlock(token, 3, 2);

		insights(token).andExpect(status().isOk())
			.andExpect(jsonPath("$.streak.weeks", is(3)))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(3)));
	}

	@Test
	void streakIsZeroWithoutGoal() throws Exception {
		String token = bearerToken();
		sessionsInBlock(token, 0, 3);
		sessionsInBlock(token, 1, 3);

		insights(token).andExpect(status().isOk())
			.andExpect(jsonPath("$.streak.goal", nullValue()))
			.andExpect(jsonPath("$.streak.weeks", is(0)))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(3)));
	}

	@Test
	void validGoalPersistsAndShowsInInsights() throws Exception {
		String token = bearerToken();
		putGoal(token, "{\"weeklyGoal\":4}").andExpect(status().isOk()).andExpect(jsonPath("$.weeklyGoal", is(4)));
		putGoal(token, "{\"weeklyGoal\":14}").andExpect(status().isOk()).andExpect(jsonPath("$.weeklyGoal", is(14)));
		putGoal(token, "{\"weeklyGoal\":1}").andExpect(status().isOk());

		insights(token).andExpect(jsonPath("$.streak.goal", is(1)));
	}

	@Test
	void nullGoalClearsIt() throws Exception {
		String token = bearerToken();
		putGoal(token, "{\"weeklyGoal\":3}").andExpect(status().isOk());
		putGoal(token, "{\"weeklyGoal\":null}").andExpect(status().isOk())
			.andExpect(jsonPath("$.weeklyGoal", nullValue()));

		insights(token).andExpect(jsonPath("$.streak.goal", nullValue()));
	}

	@Test
	void invalidGoalsAreRejectedWithErrorBody() throws Exception {
		String token = bearerToken();
		for (String body : new String[] { "{\"weeklyGoal\":0}", "{\"weeklyGoal\":15}", "{\"weeklyGoal\":-1}",
				"{\"weeklyGoal\":2.5}", "{\"weeklyGoal\":\"abc\"}", "{\"weeklyGoal\":true}", "{}", "{bad", "" }) {
			putGoal(token, body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error", notNullValue()));
		}
		putGoal(token, "{\"weeklyGoal\":0}").andExpect(jsonPath("$.code", is("INVALID_WEEKLY_GOAL")));
		putGoal(token, "{}").andExpect(jsonPath("$.code", is("INVALID_WEEKLY_GOAL")));
		putGoal(token, "{bad").andExpect(jsonPath("$.code", is("MALFORMED_BODY")));
		insights(token).andExpect(jsonPath("$.streak.goal", nullValue()));
	}

	@Test
	void goalIsScopedToTheUser() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		putGoal(tokenA, "{\"weeklyGoal\":5}").andExpect(status().isOk());

		insights(tokenB).andExpect(jsonPath("$.streak.goal", nullValue()));
	}

	@Test
	void goalAndInsightsWithoutTokenAreUnauthorized() throws Exception {
		mockMvc.perform(put("/api/dashboard/weekly-goal").contentType(MediaType.APPLICATION_JSON)
			.content("{\"weeklyGoal\":3}")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/dashboard/insights")).andExpect(status().isUnauthorized());
	}

	@Test
	void firstSetAndTiesAreNotRecordsButHigherScoreIs() throws Exception {
		String token = bearerToken();
		UUID exercise = exerciseA();
		endedSession(token, Duration.ofDays(10), new S(exercise, 5, "60"));
		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(0)));

		endedSession(token, Duration.ofDays(5), new S(exercise, 5, "60"));
		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(0)));

		endedSession(token, Duration.ofDays(2), new S(exercise, 5, "70"));
		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(1)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].exerciseId", is(exercise.toString())))
			.andExpect(jsonPath("$.recentPersonalRecords[0].exerciseName", notNullValue()))
			.andExpect(jsonPath("$.recentPersonalRecords[0].reps", is(5)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].weightKg", closeTo(70.0, 0.001)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].achievedAt", notNullValue()));
	}

	@Test
	void setsAboveEligibleRepsAreIgnored() throws Exception {
		String token = bearerToken();
		UUID exercise = exerciseA();
		endedSession(token, Duration.ofDays(5), new S(exercise, 5, "60"));
		// 16 reps is above the eligible cap: neither a record nor a baseline raise
		endedSession(token, Duration.ofDays(3), new S(exercise, 16, "200"), new S(exercise, 5, "65"));

		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(1)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].weightKg", closeTo(65.0, 0.001)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].reps", is(5)));
	}

	@Test
	void recordsAreNewestFirstAndCappedAtFive() throws Exception {
		String token = bearerToken();
		UUID exercise = exerciseA();
		endedSession(token, Duration.ofDays(30), new S(exercise, 5, "50"));
		for (int i = 1; i <= 6; i++) {
			endedSession(token, Duration.ofDays(30 - i * 3), new S(exercise, 5, String.valueOf(50 + i * 5)));
		}

		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(5)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].weightKg", closeTo(80.0, 0.001)))
			.andExpect(jsonPath("$.recentPersonalRecords[4].weightKg", closeTo(60.0, 0.001)));
	}

	@Test
	void activeSessionSetsAreExcluded() throws Exception {
		String token = bearerToken();
		UUID exercise = exerciseA();
		endedSession(token, Duration.ofDays(3), new S(exercise, 5, "60"));
		String active = startSession(token);
		logSet(token, active, new S(exercise, 5, "100"));

		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(0)))
			.andExpect(jsonPath("$.streak.currentWeekWorkouts", is(1)));
	}

	@Test
	void insightsRecordMatchesTheSetFlaggedInHistoryDetail() throws Exception {
		String token = bearerToken();
		UUID a = exerciseA();
		UUID b = exerciseB();
		endedSession(token, Duration.ofDays(9), new S(a, 5, "60"), new S(b, 8, "40"));
		String sessionId = endedSession(token, Duration.ofDays(2), new S(a, 5, "60"), new S(a, 6, "62.5"),
				new S(b, 8, "40"), new S(b, 8, "42.5"));

		insights(token).andExpect(jsonPath("$.recentPersonalRecords", hasSize(2)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].sessionId", is(sessionId)))
			.andExpect(jsonPath("$.recentPersonalRecords[0].exerciseId", is(b.toString())))
			.andExpect(jsonPath("$.recentPersonalRecords[0].weightKg", closeTo(42.5, 0.001)))
			.andExpect(jsonPath("$.recentPersonalRecords[1].exerciseId", is(a.toString())))
			.andExpect(jsonPath("$.recentPersonalRecords[1].weightKg", closeTo(62.5, 0.001)));

		String detail = mockMvc.perform(get("/api/workout-sessions/" + sessionId)
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andReturn()
			.getResponse()
			.getContentAsString();
		List<Number> flaggedWeights = JsonPath.read(detail,
				"$.exercises[*].sets[?(@.personalRecord == true)].weightKg");
		assertEquals(2, flaggedWeights.size());
		assertTrue(flaggedWeights.stream().anyMatch(weight -> weight.doubleValue() == 62.5));
		assertTrue(flaggedWeights.stream().anyMatch(weight -> weight.doubleValue() == 42.5));
	}

	@Test
	void otherUsersDataNeverLeaks() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		UUID exercise = exerciseA();
		endedSession(tokenA, Duration.ofDays(5), new S(exercise, 5, "60"));
		endedSession(tokenA, Duration.ofDays(2), new S(exercise, 5, "70"));

		insights(tokenB).andExpect(status().isOk())
			.andExpect(jsonPath("$.weeklyVolume[?(@.workoutCount > 0)]", hasSize(0)))
			.andExpect(jsonPath("$.recentPersonalRecords", hasSize(0)));
	}

}
