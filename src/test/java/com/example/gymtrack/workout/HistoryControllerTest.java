package com.example.gymtrack.workout;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
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
class HistoryControllerTest {

	private static final String LIST_URL = "/api/workout-sessions";

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
		return userRepository.save(
				new User("history-" + System.nanoTime() + "@example.com", passwordEncoder.encode("password123")));
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

	private TrainingPlan plan(User user, String name) {
		TrainingPlan plan = new TrainingPlan(user.getId(), name);
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

	private org.springframework.test.web.servlet.ResultActions list(User user, String... params) throws Exception {
		var request = get(LIST_URL).header(HttpHeaders.AUTHORIZATION, bearer(user));
		for (int i = 0; i < params.length; i += 2) {
			request.param(params[i], params[i + 1]);
		}
		return mockMvc.perform(request);
	}

	private org.springframework.test.web.servlet.ResultActions detail(User user, UUID id) throws Exception {
		return mockMvc.perform(get(LIST_URL + "/" + id).header(HttpHeaders.AUTHORIZATION, bearer(user)));
	}

	@Test
	void listWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(LIST_URL)).andExpect(status().isUnauthorized());
	}

	@Test
	void detailWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(LIST_URL + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
	}

	@Test
	void listsEndedSessionsNewestFirstWithAggregates() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		WorkoutSession older = endedSession(user, null, set(exerciseId, 10, "50"));
		WorkoutSession newer = endedSession(user, null, set(exerciseId, 10, "60"), set(otherExerciseId(), 8, "22.5"));

		list(user).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].id", is(newer.getId().toString())))
			.andExpect(jsonPath("$.items[0].setCount", is(2)))
			.andExpect(jsonPath("$.items[0].volumeKg", is(780.0)))
			.andExpect(jsonPath("$.items[0].durationSeconds", notNullValue()))
			.andExpect(jsonPath("$.items[0].endedAt", notNullValue()))
			.andExpect(jsonPath("$.items[1].id", is(older.getId().toString())))
			.andExpect(jsonPath("$.items[1].setCount", is(1)))
			.andExpect(jsonPath("$.items[1].volumeKg", is(500.0)))
			.andExpect(jsonPath("$.page", is(0)))
			.andExpect(jsonPath("$.size", is(20)))
			.andExpect(jsonPath("$.totalElements", is(2)))
			.andExpect(jsonPath("$.totalPages", is(1)));
	}

	@Test
	void durationIsSecondsBetweenStartAndEnd() throws Exception {
		User user = newUser();
		endedSession(user, null, set(exerciseId(), 10, "50"));

		list(user).andExpect(status().isOk())
			.andExpect(jsonPath("$.items[0].durationSeconds", is(0)));
	}

	@Test
	void runningSessionIsExcluded() throws Exception {
		User user = newUser();
		runningSession(user, null, set(exerciseId(), 10, "50"));

		list(user).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)))
			.andExpect(jsonPath("$.totalElements", is(0)));
	}

	@Test
	void sessionWithoutSetsHasZeroSetsAndVolume() throws Exception {
		User user = newUser();
		endedSession(user, null);

		list(user).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].setCount", is(0)))
			.andExpect(jsonPath("$.items[0].volumeKg", is(0)));
	}

	@Test
	void pagesOverFiveSessions() throws Exception {
		User user = newUser();
		for (int i = 0; i < 5; i++) {
			endedSession(user, null, set(exerciseId(), 10, "50"));
		}

		list(user, "page", "0", "size", "2").andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.page", is(0)))
			.andExpect(jsonPath("$.size", is(2)))
			.andExpect(jsonPath("$.totalElements", is(5)))
			.andExpect(jsonPath("$.totalPages", is(3)));
		list(user, "page", "1", "size", "2").andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)));
		list(user, "page", "2", "size", "2").andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(1)));
		list(user, "page", "3", "size", "2").andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)))
			.andExpect(jsonPath("$.totalElements", is(5)));
	}

	@Test
	void defaultSizeIsTwenty() throws Exception {
		User user = newUser();
		endedSession(user, null);

		list(user).andExpect(status().isOk()).andExpect(jsonPath("$.size", is(20)));
	}

	@Test
	void invalidPagingReturnsBadRequest() throws Exception {
		User user = newUser();

		list(user, "size", "51").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error", notNullValue()));
		list(user, "size", "0").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error", notNullValue()));
		list(user, "page", "-1").andExpect(status().isBadRequest()).andExpect(jsonPath("$.error", notNullValue()));
		list(user, "size", "51").andExpect(jsonPath("$.code", is("INVALID_HISTORY_SIZE")));
		list(user, "size", "0").andExpect(jsonPath("$.code", is("INVALID_HISTORY_SIZE")));
		list(user, "page", "-1").andExpect(jsonPath("$.code", is("INVALID_HISTORY_PAGE")));
	}

	@Test
	void planIdWithNoPlanReturnsBadRequest() throws Exception {
		User user = newUser();

		list(user, "planId", UUID.randomUUID().toString(), "noPlan", "true").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_HISTORY_FILTER")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void malformedParametersReturnBadRequest() throws Exception {
		User user = newUser();

		list(user, "planId", "not-a-uuid").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_PARAMETER")))
			.andExpect(jsonPath("$.field", is("planId")))
			.andExpect(jsonPath("$.error", is("Invalid planId")));
		list(user, "page", "abc").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_PARAMETER")))
			.andExpect(jsonPath("$.field", is("page")))
			.andExpect(jsonPath("$.error", is("Invalid page")));
		detail(user, UUID.randomUUID()).andExpect(status().isNotFound());
		mockMvc.perform(get(LIST_URL + "/not-a-uuid").header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("INVALID_PARAMETER")))
			.andExpect(jsonPath("$.field", is("id")))
			.andExpect(jsonPath("$.error", is("Invalid id")));
	}

	@Test
	void planFilterReturnsOnlyThatPlansSessions() throws Exception {
		User user = newUser();
		TrainingPlan plan = plan(user, "Push");
		TrainingPlan otherPlan = plan(user, "Pull");
		WorkoutSession inPlan = endedSession(user, plan.getId(), set(exerciseId(), 10, "50"));
		endedSession(user, otherPlan.getId(), set(exerciseId(), 10, "50"));
		endedSession(user, null, set(exerciseId(), 10, "50"));

		list(user, "planId", plan.getId().toString()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].id", is(inPlan.getId().toString())))
			.andExpect(jsonPath("$.items[0].planName", is("Push")))
			.andExpect(jsonPath("$.totalElements", is(1)));
	}

	@Test
	void noPlanReturnsFreeFormAndDeletedPlanSessions() throws Exception {
		User user = newUser();
		TrainingPlan live = plan(user, "Live");
		TrainingPlan deleted = plan(user, "Deleted");
		endedSession(user, live.getId(), set(exerciseId(), 10, "50"));
		WorkoutSession freeForm = endedSession(user, null, set(exerciseId(), 10, "50"));
		WorkoutSession orphan = endedSession(user, deleted.getId(), set(exerciseId(), 10, "50"));
		planRepository.delete(deleted);
		planRepository.flush();

		list(user, "noPlan", "true").andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].id", is(orphan.getId().toString())))
			.andExpect(jsonPath("$.items[1].id", is(freeForm.getId().toString())));
	}

	@Test
	void planNamePresentForLivePlanAndNullForDeletedOne() throws Exception {
		User user = newUser();
		TrainingPlan live = plan(user, "Legs");
		TrainingPlan deleted = plan(user, "Gone");
		endedSession(user, live.getId(), set(exerciseId(), 10, "50"));
		endedSession(user, deleted.getId(), set(exerciseId(), 10, "50"));
		planRepository.delete(deleted);
		planRepository.flush();

		list(user).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].planId", nullValue()))
			.andExpect(jsonPath("$.items[0].planName", nullValue()))
			.andExpect(jsonPath("$.items[1].planName", is("Legs")));
	}

	@Test
	void anotherUsersPlanIdReturnsEmptyPage() throws Exception {
		User owner = newUser();
		User other = newUser();
		TrainingPlan plan = plan(owner, "Mine");
		endedSession(owner, plan.getId(), set(exerciseId(), 10, "50"));

		list(other, "planId", plan.getId().toString()).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)))
			.andExpect(jsonPath("$.totalElements", is(0)));
	}

	@Test
	void otherUsersSessionsNeverLeak() throws Exception {
		User owner = newUser();
		User other = newUser();
		endedSession(other, null, set(exerciseId(), 10, "50"));

		list(owner).andExpect(status().isOk())
			.andExpect(jsonPath("$.items", hasSize(0)))
			.andExpect(jsonPath("$.totalElements", is(0)));
	}

	@Test
	void detailGroupsSetsPerExerciseInFirstLoggedOrder() throws Exception {
		User user = newUser();
		UUID first = exerciseId();
		UUID second = otherExerciseId();
		TrainingPlan plan = plan(user, "Upper");
		// Logged order: second, first, second, first -> exercises ordered second, first.
		WorkoutSession session = endedSession(user, plan.getId(), set(second, 12, "20"), set(first, 10, "60"),
				set(second, 11, "22.5"), set(first, 9, "62.5"));

		detail(user, session.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(session.getId().toString())))
			.andExpect(jsonPath("$.planId", is(plan.getId().toString())))
			.andExpect(jsonPath("$.planName", is("Upper")))
			.andExpect(jsonPath("$.durationSeconds", notNullValue()))
			.andExpect(jsonPath("$.volumeKg", is(1650.0)))
			.andExpect(jsonPath("$.exercises", hasSize(2)))
			.andExpect(jsonPath("$.exercises[0].exerciseId", is(second.toString())))
			.andExpect(jsonPath("$.exercises[0].sets", hasSize(2)))
			.andExpect(jsonPath("$.exercises[0].sets[0].reps", is(12)))
			.andExpect(jsonPath("$.exercises[0].sets[0].weightKg", is(20.0)))
			.andExpect(jsonPath("$.exercises[0].sets[1].reps", is(11)))
			.andExpect(jsonPath("$.exercises[0].sets[1].weightKg", is(22.5)))
			.andExpect(jsonPath("$.exercises[1].exerciseId", is(first.toString())))
			.andExpect(jsonPath("$.exercises[1].sets[0].reps", is(10)))
			.andExpect(jsonPath("$.exercises[1].sets[1].reps", is(9)))
			.andExpect(jsonPath("$.exercises[1].sets[1].weightKg", is(62.5)));
	}

	@Test
	void detailOfRunningSessionReturnsNotFound() throws Exception {
		User user = newUser();
		WorkoutSession running = runningSession(user, null, set(exerciseId(), 10, "50"));

		detail(user, running.getId()).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("WORKOUT_NOT_FOUND")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void detailOfAnotherUsersSessionReturnsNotFound() throws Exception {
		User owner = newUser();
		User other = newUser();
		WorkoutSession session = endedSession(owner, null, set(exerciseId(), 10, "50"));

		detail(other, session.getId()).andExpect(status().isNotFound());
	}

	@Test
	void detailOfUnknownIdReturnsNotFound() throws Exception {
		detail(newUser(), UUID.randomUUID()).andExpect(status().isNotFound());
	}

	@Test
	void currentSessionEndpointStillWorks() throws Exception {
		User user = newUser();

		mockMvc.perform(get(LIST_URL + "/current").header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isNoContent())
			.andExpect(content().string(""));
	}

}
