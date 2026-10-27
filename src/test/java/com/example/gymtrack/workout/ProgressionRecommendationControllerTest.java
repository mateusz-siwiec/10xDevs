package com.example.gymtrack.workout;

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
class ProgressionRecommendationControllerTest {

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
		return userRepository.save(new User("recommendation-" + System.nanoTime() + "@example.com",
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

	private TrainingPlan plan(User user, UUID exerciseId, int sets, int reps) {
		TrainingPlan plan = new TrainingPlan(user.getId(), "Plan " + System.nanoTime());
		plan.replaceEntries(List.of(new PlanEntryInput(exerciseId, sets, reps)));
		return planRepository.saveAndFlush(plan);
	}

	/** A set to log: reps at weight. */
	private record Entry(int reps, String weightKg) {
	}

	private static Entry set(int reps, String weightKg) {
		return new Entry(reps, weightKg);
	}

	private Entry[] threeByTen(String weightKg) {
		return new Entry[] { set(10, weightKg), set(10, weightKg), set(10, weightKg) };
	}

	private WorkoutSession sessionWithSets(User user, UUID planId, UUID exerciseId, Entry... entries) {
		WorkoutSession session = sessionRepository.saveAndFlush(new WorkoutSession(user.getId(), planId));
		for (Entry entry : entries) {
			setRepository.saveAndFlush(
					new WorkoutSet(session, exerciseId, entry.reps(), new BigDecimal(entry.weightKg())));
		}
		return session;
	}

	/** Creates and ends a session; sleeps first so endedAt ordering follows call order. */
	private WorkoutSession endedSession(User user, UUID planId, UUID exerciseId, Entry... entries)
			throws InterruptedException {
		Thread.sleep(10);
		WorkoutSession session = sessionWithSets(user, planId, exerciseId, entries);
		session.end();
		return sessionRepository.saveAndFlush(session);
	}

	private String url(UUID exerciseId) {
		return "/api/exercises/" + exerciseId + "/progression-recommendation";
	}

	private void assertRecommended(User user, UUID exerciseId, double current, double recommended)
			throws Exception {
		mockMvc.perform(get(url(exerciseId)).header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.exerciseId", is(exerciseId.toString())))
			.andExpect(jsonPath("$.currentWeightKg", is(current)))
			.andExpect(jsonPath("$.recommendedWeightKg", is(recommended)))
			.andExpect(jsonPath("$.workouts", is(2)))
			.andExpect(jsonPath("$.targetSets", is(3)))
			.andExpect(jsonPath("$.targetReps", is(10)));
	}

	private void assertNoRecommendation(User user, UUID exerciseId) throws Exception {
		mockMvc.perform(get(url(exerciseId)).header(HttpHeaders.AUTHORIZATION, bearer(user)))
			.andExpect(status().isNoContent())
			.andExpect(content().string(""));
	}

	private void twoQualifying(User user, UUID exerciseId, String weightKg) throws Exception {
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen(weightKg));
		endedSession(user, plan.getId(), exerciseId, threeByTen(weightKg));
	}

	@Test
	void withoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get(url(UUID.randomUUID()))).andExpect(status().isUnauthorized());
	}

	@Test
	void unknownExerciseReturnsNotFound() throws Exception {
		mockMvc.perform(get(url(UUID.randomUUID())).header(HttpHeaders.AUTHORIZATION, bearer(newUser())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void twoQualifyingSessionsAtSameTopWeightRecommendIncrease() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		twoQualifying(user, exerciseId, "60");

		assertRecommended(user, exerciseId, 60.0, 61.5);
	}

	@Test
	void roundingBoundaries() throws Exception {
		UUID exerciseId = exerciseId();

		// 5 kg: 2.5% is below the minimum step, so the +0.5 kg floor applies.
		User light = newUser();
		twoQualifying(light, exerciseId, "5");
		assertRecommended(light, exerciseId, 5.0, 5.5);

		// 10 kg: 10.25 rounds half up to 10.5.
		User ten = newUser();
		twoQualifying(ten, exerciseId, "10");
		assertRecommended(ten, exerciseId, 10.0, 10.5);

		User hundred = newUser();
		twoQualifying(hundred, exerciseId, "100");
		assertRecommended(hundred, exerciseId, 100.0, 102.5);
	}

	@Test
	void recommendationAboveMaxWeightIsSuppressed() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		twoQualifying(user, exerciseId, "1000");

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void singleEndedSessionGivesNoRecommendation() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void runningSessionIsIgnored() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		sessionWithSets(user, plan.getId(), exerciseId, threeByTen("60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void sessionShortOnSetsBreaksTheRule() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, set(10, "60"), set(10, "60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void repBelowTargetBreaksTheRule() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, set(10, "60"), set(9, "60"), set(10, "60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void lighterWarmUpSetsDoNotBreakAQualifyingSession() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, set(5, "40"), set(10, "60"), set(10, "60"), set(10, "60"));
		endedSession(user, plan.getId(), exerciseId, set(8, "30"), set(10, "60"), set(10, "60"), set(10, "60"));

		assertRecommended(user, exerciseId, 60.0, 61.5);
	}

	@Test
	void differentTopWeightsAcrossSessionsGiveNoRecommendation() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, threeByTen("62.5"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void inBetweenSessionWithoutPlanBreaksTheStreak() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, null, exerciseId, threeByTen("60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void deletedPlanGivesNoRecommendation() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, exerciseId, 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		planRepository.deleteById(plan.getId());
		planRepository.flush();

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void exerciseAbsentFromThePlanGivesNoRecommendation() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = plan(user, otherExerciseId(), 3, 10);
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, plan.getId(), exerciseId, threeByTen("60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void otherUsersSessionsNeverLeak() throws Exception {
		User owner = newUser();
		User other = newUser();
		UUID exerciseId = exerciseId();
		twoQualifying(owner, exerciseId, "60");

		assertNoRecommendation(other, exerciseId);
	}

	@Test
	void duplicateExerciseInPlanUsesTheFirstEntryAsTarget() throws Exception {
		User user = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan plan = new TrainingPlan(user.getId(), "Plan " + System.nanoTime());
		plan.replaceEntries(List.of(new PlanEntryInput(exerciseId, 3, 10), new PlanEntryInput(exerciseId, 2, 8)));
		plan = planRepository.saveAndFlush(plan);
		// 2 x 8 would satisfy the second entry, but the first (3 x 10) is the target.
		endedSession(user, plan.getId(), exerciseId, set(8, "60"), set(8, "60"));
		endedSession(user, plan.getId(), exerciseId, set(8, "60"), set(8, "60"));

		assertNoRecommendation(user, exerciseId);
	}

	@Test
	void sessionsOfAnotherUsersPlanGiveNoRecommendation() throws Exception {
		User user = newUser();
		User planOwner = newUser();
		UUID exerciseId = exerciseId();
		TrainingPlan foreignPlan = plan(planOwner, exerciseId, 3, 10);
		endedSession(user, foreignPlan.getId(), exerciseId, threeByTen("60"));
		endedSession(user, foreignPlan.getId(), exerciseId, threeByTen("60"));

		assertNoRecommendation(user, exerciseId);
	}

}
