package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.plan.PlanEntryInput;
import com.example.gymtrack.plan.TrainingPlan;
import com.example.gymtrack.plan.TrainingPlanRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import java.math.BigDecimal;
import java.util.List;
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
class PreviousWorkoutControllerTest {

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
	private TrainingPlanRepository planRepository;

	@Autowired
	private WorkoutSessionRepository sessionRepository;

	@Autowired
	private WorkoutSetRepository setRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	private User newUser() {
		return userRepository.save(new User("previous-workout-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
	}

	private String bearer(User user) {
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID exerciseId() {
		return exerciseRepository.findAllByOrderByNameAsc().get(0).getId();
	}

	private UUID otherExerciseId() {
		return exerciseRepository.findAllByOrderByNameAsc().get(1).getId();
	}

	private TrainingPlan plan(User user) {
		TrainingPlan plan = new TrainingPlan(user.getId(), "Plan " + System.nanoTime());
		plan.replaceEntries(List.of(new PlanEntryInput(exerciseId(), 3, 10)));
		return planRepository.saveAndFlush(plan);
	}

	private record Entry(UUID exerciseId, int reps, String weightKg) {
	}

	private Entry set(UUID exerciseId, int reps, String weightKg) {
		return new Entry(exerciseId, reps, weightKg);
	}

	private WorkoutSession runningSession(User user, UUID planId, Entry... entries) throws InterruptedException {
		Thread.sleep(10);
		WorkoutSession session = sessionRepository.saveAndFlush(new WorkoutSession(user.getId(), planId));
		for (Entry entry : entries) {
			Thread.sleep(5);
			setRepository.saveAndFlush(
					new WorkoutSet(session, entry.exerciseId(), entry.reps(), new BigDecimal(entry.weightKg())));
		}
		return session;
	}

	/** Creates and ends a session; sleeps first so endedAt ordering follows call order. */
	private WorkoutSession endedSession(User user, UUID planId, Entry... entries) throws InterruptedException {
		WorkoutSession session = runningSession(user, planId, entries);
		session.end();
		return sessionRepository.saveAndFlush(session);
	}

	private String url(UUID exerciseId) {
		return "/api/exercises/" + exerciseId + "/previous-workout";
	}

	private void assertNoPrevious(User user, UUID exerciseId, UUID planId) throws Exception {
		mockMvc.perform(get(url(exerciseId)).param("planId", planId.toString())
			.header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isNoContent())
			.andExpect(content().string(""));
	}

	@Test
	void withoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(url(UUID.randomUUID())).param("planId", UUID.randomUUID().toString()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void unknownExerciseReturnsNotFound() throws Exception {
		mockMvc
			.perform(get(url(UUID.randomUUID())).param("planId", UUID.randomUUID().toString())
				.header(HttpHeaders.AUTHORIZATION, bearer(newUser())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("EXERCISE_NOT_FOUND")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void malformedPlanIdReturnsBadRequest() throws Exception {
		mockMvc
			.perform(get(url(exerciseId())).param("planId", "not-a-uuid")
				.header(HttpHeaders.AUTHORIZATION, bearer(newUser())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_PARAMETER")))
			.andExpect(jsonPath("$.field", is("planId")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void missingPlanIdReturnsBadRequest() throws Exception {
		mockMvc.perform(get(url(exerciseId())).header(HttpHeaders.AUTHORIZATION, bearer(newUser())))
			.andExpect(status().isBadRequest());
	}

	@Test
	void returnsAllSetsOfPreviousSessionInLoggedOrderIncludingWarmUp() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		WorkoutSession session = endedSession(user, plan.getId(), set(exerciseId, 5, "40"),
				set(exerciseId, 10, "60"), set(exerciseId, 9, "60"), set(exerciseId, 8, "62.5"));

		mockMvc
			.perform(get(url(exerciseId)).param("planId", plan.getId().toString())
				.header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.exerciseId", is(exerciseId.toString())))
			.andExpect(jsonPath("$.sessionId", is(session.getId().toString())))
			.andExpect(jsonPath("$.endedAt", notNullValue()))
			.andExpect(jsonPath("$.sets", hasSize(4)))
			.andExpect(jsonPath("$.sets[0].reps", is(5)))
			.andExpect(jsonPath("$.sets[0].weightKg", is(40.0)))
			.andExpect(jsonPath("$.sets[1].reps", is(10)))
			.andExpect(jsonPath("$.sets[1].weightKg", is(60.0)))
			.andExpect(jsonPath("$.sets[2].reps", is(9)))
			.andExpect(jsonPath("$.sets[3].reps", is(8)))
			.andExpect(jsonPath("$.sets[3].weightKg", is(62.5)));
	}

	@Test
	void setsOfOtherExercisesAreExcluded() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		endedSession(user, plan.getId(), set(exerciseId, 10, "60"), set(otherExerciseId(), 12, "20"),
				set(exerciseId, 9, "60"));

		mockMvc
			.perform(get(url(exerciseId)).param("planId", plan.getId().toString())
				.header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sets", hasSize(2)))
			.andExpect(jsonPath("$.sets[0].reps", is(10)))
			.andExpect(jsonPath("$.sets[1].reps", is(9)));
	}

	@Test
	void newestSessionWithoutTheExerciseIsSkipped() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		WorkoutSession older = endedSession(user, plan.getId(), set(exerciseId, 10, "60"));
		endedSession(user, plan.getId(), set(otherExerciseId(), 12, "20"));

		mockMvc
			.perform(get(url(exerciseId)).param("planId", plan.getId().toString())
				.header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sessionId", is(older.getId().toString())));
	}

	@Test
	void onlyTheMostRecentMatchingSessionIsReturned() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		endedSession(user, plan.getId(), set(exerciseId, 10, "50"));
		WorkoutSession newest = endedSession(user, plan.getId(), set(exerciseId, 10, "60"));

		mockMvc
			.perform(get(url(exerciseId)).param("planId", plan.getId().toString())
				.header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.sessionId", is(newest.getId().toString())))
			.andExpect(jsonPath("$.sets", hasSize(1)))
			.andExpect(jsonPath("$.sets[0].weightKg", is(60.0)));
	}

	@Test
	void sessionsOfAnotherPlanAreIgnored() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		TrainingPlan otherPlan = plan(user);
		endedSession(user, otherPlan.getId(), set(exerciseId, 10, "60"));

		assertNoPrevious(user, exerciseId, plan.getId());
	}

	@Test
	void freeFormSessionIsIgnored() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		endedSession(user, null, set(exerciseId, 10, "60"));

		assertNoPrevious(user, exerciseId, plan.getId());
	}

	@Test
	void runningSessionIsIgnored() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user);
		runningSession(user, plan.getId(), set(exerciseId, 10, "60"));

		assertNoPrevious(user, exerciseId, plan.getId());
	}

	@Test
	void otherUsersSessionsNeverLeak() throws Exception {
		User owner = newUser();
		User other = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(owner);
		// The other user's session carries the owner's planId.
		endedSession(other, plan.getId(), set(exerciseId, 10, "60"));

		assertNoPrevious(owner, exerciseId, plan.getId());
	}

	@Test
	void noHistoryReturnsNoContent() throws Exception {
		User user = newUser();
		TrainingPlan plan = plan(user);

		assertNoPrevious(user, exerciseId(), plan.getId());
	}

}
