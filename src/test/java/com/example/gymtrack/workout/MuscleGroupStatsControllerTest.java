package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.exercise.MuscleGroup;
import com.example.gymtrack.exercise.MuscleParent;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.Collectors;
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
class MuscleGroupStatsControllerTest {

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
		User user = userRepository.save(new User("muscle-stats-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID catalogExercise(MuscleGroup group) {
		return exerciseRepository.findAllByOrderByNameAsc()
			.stream()
			.filter(exercise -> exercise.getOwnerId() == null && exercise.getPrimaryMuscleGroup() == group)
			.findFirst()
			.orElseThrow()
			.getId();
	}

	private String startSession(String token) throws Exception {
		String body = mockMvc.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.id");
	}

	private void logSets(String token, String sessionId, UUID exerciseId, int count) throws Exception {
		String body = "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":8,\"weightKg\":50}";
		for (int i = 0; i < count; i++) {
			mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
					.header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isCreated());
		}
	}

	private void endSession(String token, String sessionId) throws Exception {
		mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/end").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
	}

	/** An ended session with {@code count} sets of the exercise, ended {@code daysAgo} days ago. */
	private void endedSession(String token, UUID exerciseId, int count, int daysAgo) throws Exception {
		String sessionId = startSession(token);
		logSets(token, sessionId, exerciseId, count);
		endSession(token, sessionId);
		Instant endedAt = Instant.now().minus(daysAgo, ChronoUnit.DAYS);
		jdbcTemplate.update("update workout_sessions set started_at = ?, ended_at = ? where id = ?",
				OffsetDateTime.ofInstant(endedAt.minusSeconds(3600), ZoneOffset.UTC),
				OffsetDateTime.ofInstant(endedAt, ZoneOffset.UTC), UUID.fromString(sessionId));
	}

	private void logFailureSets(String token, String sessionId, UUID exerciseId, int count) throws Exception {
		String body = "{\"exerciseId\":\"" + exerciseId + "\",\"reps\":8,\"weightKg\":50,\"toFailure\":true}";
		for (int i = 0; i < count; i++) {
			mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
					.header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
				.andExpect(status().isCreated());
		}
	}

	private void endedSessionWithFailure(String token, UUID exerciseId, int normal, int failure, int daysAgo)
			throws Exception {
		String sessionId = startSession(token);
		logSets(token, sessionId, exerciseId, normal);
		logFailureSets(token, sessionId, exerciseId, failure);
		endSession(token, sessionId);
		Instant endedAt = Instant.now().minus(daysAgo, ChronoUnit.DAYS);
		jdbcTemplate.update("update workout_sessions set started_at = ?, ended_at = ? where id = ?",
				OffsetDateTime.ofInstant(endedAt.minusSeconds(3600), ZoneOffset.UTC),
				OffsetDateTime.ofInstant(endedAt, ZoneOffset.UTC), UUID.fromString(sessionId));
	}

	@Test
	void countsFailureSetsPerGroupWithinTheSetTotals() throws Exception {
		String token = bearerToken();
		endedSessionWithFailure(token, catalogExercise(MuscleGroup.MID_CHEST), 2, 1, 1);
		endedSession(token, catalogExercise(MuscleGroup.LATS), 2, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.totalSets", is(5)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].sets", contains(3)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].failureSets", contains(1)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'LATS')].failureSets", contains(0)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'ABS')].failureSets", contains(0)));
	}

	@Test
	void failureSetsFollowTheWindowAndIgnoreOtherUsersAndActiveWorkouts() throws Exception {
		String token = bearerToken();
		UUID chest = catalogExercise(MuscleGroup.MID_CHEST);
		endedSessionWithFailure(token, chest, 0, 2, 10);
		endedSessionWithFailure(bearerToken(), chest, 0, 3, 1);
		String active = startSession(token);
		logFailureSets(token, active, chest, 4);

		mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].failureSets", contains(0)));
		mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", "30").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].failureSets", contains(2)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].sets", contains(2)));
	}

	@Test
	void emptyUserGetsEveryMuscleGroupWithZeroSets() throws Exception {
		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days", is(30)))
			.andExpect(jsonPath("$.totalSets", is(0)))
			.andExpect(jsonPath("$.groups", hasSize(MuscleGroup.values().length)))
			.andExpect(jsonPath("$.groups[0].muscleGroup", is("UPPER_CHEST")))
			.andExpect(jsonPath("$.groups[1].muscleGroup", is("MID_CHEST")))
			.andExpect(jsonPath("$.groups[2].muscleGroup", is("LOWER_CHEST")))
			.andExpect(jsonPath("$.groups[?(@.sets != 0)]", hasSize(0)))
			.andExpect(jsonPath("$.parents", hasSize(MuscleParent.values().length)))
			.andExpect(jsonPath("$.parents[*].parent",
					contains("CHEST", "BACK", "SHOULDERS", "ARMS", "LEGS", "CORE")))
			.andExpect(jsonPath("$.parents[?(@.sets != 0)]", hasSize(0)));
	}

	@Test
	void countsEverySetUnderItsExercisesPrimaryMuscleGroup() throws Exception {
		String token = bearerToken();
		endedSession(token, catalogExercise(MuscleGroup.MID_CHEST), 3, 1);
		endedSession(token, catalogExercise(MuscleGroup.LATS), 2, 2);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalSets", is(5)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].sets", contains(3)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'LATS')].sets", contains(2)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'ABS')].sets", contains(0)));
	}

	@Test
	void setsFromOneSessionAcrossGroupsAreSplitPerGroup() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		logSets(token, sessionId, catalogExercise(MuscleGroup.QUADS), 4);
		logSets(token, sessionId, catalogExercise(MuscleGroup.CALVES), 1);
		endSession(token, sessionId);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'QUADS')].sets", contains(4)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'CALVES')].sets", contains(1)));
	}

	@Test
	void activeSessionSetsAreNotCounted() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		logSets(token, sessionId, catalogExercise(MuscleGroup.MID_CHEST), 3);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.totalSets", is(0)));
	}

	@Test
	void windowFiltersByWhenTheWorkoutEnded() throws Exception {
		String token = bearerToken();
		endedSession(token, catalogExercise(MuscleGroup.MID_CHEST), 3, 10);

		mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", "7").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.days", is(7)))
			.andExpect(jsonPath("$.totalSets", is(0)));
		mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", "30").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.totalSets", is(3)));
		mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", "all").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.days", nullValue()))
			.andExpect(jsonPath("$.totalSets", is(3)));
	}

	@Test
	void customExerciseCountsTowardsItsOwnPrimaryGroup() throws Exception {
		String token = bearerToken();
		String created = mockMvc.perform(post("/api/exercises").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Calf move " + System.nanoTime()
						+ "\",\"primaryMuscleGroup\":\"CALVES\",\"secondaryMuscleGroups\":[]}"))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		endedSession(token, UUID.fromString(JsonPath.read(created, "$.id")), 2, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'CALVES')].sets", contains(2)));
	}

	private UUID customExercise(String token, MuscleGroup primary, MuscleGroup... secondary) throws Exception {
		String secondaries = Arrays.stream(secondary).map(group -> "\"" + group + "\"").collect(Collectors.joining(","));
		String created = mockMvc.perform(post("/api/exercises").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"Custom move " + System.nanoTime() + "\",\"primaryMuscleGroup\":\"" + primary
						+ "\",\"secondaryMuscleGroups\":[" + secondaries + "]}"))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return UUID.fromString(JsonPath.read(created, "$.id"));
	}

	@Test
	void secondarySetsAreReportedSeparatelyFromPrimaryAndOutsideTheTotal() throws Exception {
		String token = bearerToken();
		endedSessionWithFailure(token, customExercise(token, MuscleGroup.MID_CHEST, MuscleGroup.FRONT_DELTS), 2, 1, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalSets", is(3)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].sets", contains(3)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].secondarySets", contains(0)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'MID_CHEST')].failureSets", contains(1)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'FRONT_DELTS')].sets", contains(0)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'FRONT_DELTS')].secondarySets", contains(3)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'FRONT_DELTS')].failureSets", contains(0)));
	}

	@Test
	void aParentCountsASetInBothNumbersWhenPrimaryAndSecondaryShareItButOnlyOnceInEach() throws Exception {
		String token = bearerToken();
		endedSession(token, customExercise(token, MuscleGroup.FRONT_DELTS, MuscleGroup.SIDE_DELTS), 1, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.parents[?(@.parent == 'SHOULDERS')].sets", contains(1)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'SHOULDERS')].secondarySets", contains(1)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'FRONT_DELTS')].sets", contains(1)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'SIDE_DELTS')].sets", contains(0)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'SIDE_DELTS')].secondarySets", contains(1)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'REAR_DELTS')].secondarySets", contains(0)));
	}

	@Test
	void aParentCountsASetOnceAsSecondaryEvenWhenSeveralOfItsMusclesAreSecondary() throws Exception {
		String token = bearerToken();
		UUID exercise = customExercise(token, MuscleGroup.FRONT_DELTS, MuscleGroup.SIDE_DELTS, MuscleGroup.TRICEPS,
				MuscleGroup.BICEPS);
		endedSession(token, exercise, 2, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.parents[?(@.parent == 'SHOULDERS')].sets", contains(2)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'SHOULDERS')].secondarySets", contains(2)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'ARMS')].sets", contains(0)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'ARMS')].secondarySets", contains(2)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'ARMS')].failureSets", contains(0)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'TRICEPS')].secondarySets", contains(2)))
			.andExpect(jsonPath("$.groups[?(@.muscleGroup == 'BICEPS')].secondarySets", contains(2)))
			.andExpect(jsonPath("$.parents[?(@.parent == 'CHEST')].secondarySets", contains(0)));
	}

	@Test
	void totalSetsIsTheLoggedSetCountEvenWithSecondaryMuscles() throws Exception {
		String token = bearerToken();
		endedSession(token, customExercise(token, MuscleGroup.MID_CHEST, MuscleGroup.TRICEPS, MuscleGroup.FRONT_DELTS),
				3, 1);
		endedSession(token, catalogExercise(MuscleGroup.LATS), 2, 2);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.totalSets", is(5)));
	}

	@Test
	void otherUsersSetsNeverLeak() throws Exception {
		endedSession(bearerToken(), catalogExercise(MuscleGroup.MID_CHEST), 3, 1);

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(jsonPath("$.totalSets", is(0)));
	}

	@Test
	void deletedWorkoutNoLongerCounts() throws Exception {
		String token = bearerToken();
		String sessionId = startSession(token);
		logSets(token, sessionId, catalogExercise(MuscleGroup.MID_CHEST), 3);
		endSession(token, sessionId);

		mockMvc.perform(delete("/api/workout-sessions/" + sessionId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());

		mockMvc.perform(get("/api/dashboard/muscle-groups").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.totalSets", is(0)));
	}

	@Test
	void invalidWindowReturnsBadRequest() throws Exception {
		String token = bearerToken();
		for (String days : new String[] { "0", "14", "abc", "ALL" }) {
			mockMvc.perform(get("/api/dashboard/muscle-groups").param("days", days).header(HttpHeaders.AUTHORIZATION, token))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code", is("INVALID_DASHBOARD_WINDOW")));
		}
	}

	@Test
	void withoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/dashboard/muscle-groups")).andExpect(status().isUnauthorized());
	}

}
