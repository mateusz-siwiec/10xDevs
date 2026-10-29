package com.example.gymtrack.exercise;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.plan.PlanEntryInput;
import com.example.gymtrack.plan.TrainingPlan;
import com.example.gymtrack.plan.TrainingPlanRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.example.gymtrack.workout.WorkoutSession;
import com.example.gymtrack.workout.WorkoutSessionRepository;
import com.example.gymtrack.workout.WorkoutSet;
import com.example.gymtrack.workout.WorkoutSetRepository;
import java.math.BigDecimal;
import java.util.List;
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
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class CustomExerciseControllerTest {

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
		return userRepository.save(new User("custom-ex-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
	}

	private String bearer(User user) {
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private ResultActions create(String token, String json) throws Exception {
		return mockMvc.perform(post("/api/exercises").header(HttpHeaders.AUTHORIZATION, token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	private static String body(String name, String primary, String secondary) {
		String name_ = name == null ? "null" : "\"" + name + "\"";
		String primary_ = primary == null ? "null" : "\"" + primary + "\"";
		return "{\"name\":" + name_ + ",\"primaryMuscleGroup\":" + primary_ + ",\"secondaryMuscleGroups\":["
				+ (secondary == null ? "" : "\"" + secondary + "\"") + "]}";
	}

	private UUID createdId(String token, String name) throws Exception {
		String json = create(token, body(name, "BICEPS", null)).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return UUID.fromString(com.jayway.jsonpath.JsonPath.read(json, "$.id"));
	}

	private ResultActions update(String token, UUID id, String json) throws Exception {
		return mockMvc.perform(put("/api/exercises/" + id).header(HttpHeaders.AUTHORIZATION, token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	@Test
	void createReturnsCustomExerciseThatAppearsOnlyForCreator() throws Exception {
		User owner = newUser();
		User other = newUser();
		String name = "Cable Wrist Curl " + System.nanoTime();

		create(bearer(owner), body("  " + name + "  ", "BICEPS", "CORE")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.custom", is(true)))
			.andExpect(jsonPath("$.name", is(name)))
			.andExpect(jsonPath("$.slug", startsWith("custom-")))
			.andExpect(jsonPath("$.primaryMuscleGroup", is("BICEPS")))
			.andExpect(jsonPath("$.secondaryMuscleGroups", contains("CORE")));

		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(41)))
			.andExpect(jsonPath("$[?(@.custom == true)].name", contains(name)));
		mockMvc.perform(get("/api/exercises").param("muscleGroup", "BICEPS")
			.header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(jsonPath("$[*].name", hasItem(name)));
		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, bearer(other)))
			.andExpect(jsonPath("$", hasSize(40)))
			.andExpect(jsonPath("$[*].name", not(hasItem(name))));
	}

	@Test
	void invalidBodiesReturnBadRequest() throws Exception {
		String token = bearer(newUser());

		create(token, body("   ", "BICEPS", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("name")))
			.andExpect(jsonPath("$.rule", is("NotBlank")))
			.andExpect(jsonPath("$.error", notNullValue()));
		create(token, body("x".repeat(61), "BICEPS", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("name")))
			.andExpect(jsonPath("$.rule", is("Size")))
			.andExpect(jsonPath("$.error", notNullValue()));
		create(token, body("No Group", null, null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("primaryMuscleGroup")))
			.andExpect(jsonPath("$.rule", is("NotNull")))
			.andExpect(jsonPath("$.error", notNullValue()));
		create(token, body("Same Group", "BICEPS", "BICEPS")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("secondaryMuscleGroupsExcludePrimary")))
			.andExpect(jsonPath("$.rule", is("AssertTrue")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void duplicateNamesAreRefused() throws Exception {
		User owner = newUser();
		String name = "My Move " + System.nanoTime();

		create(bearer(owner), body(" Barbell ROW ", "BACK", null)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_NAME_TAKEN")))
			.andExpect(jsonPath("$.error", notNullValue()));

		create(bearer(owner), body(name, "BICEPS", null)).andExpect(status().isCreated());
		create(bearer(owner), body(name.toUpperCase(), "BICEPS", null)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_NAME_TAKEN")))
			.andExpect(jsonPath("$.error", notNullValue()));

		create(bearer(newUser()), body(name, "BICEPS", null)).andExpect(status().isCreated());
	}

	@Test
	void deleteRemovesUnusedOwnExercise() throws Exception {
		String token = bearer(newUser());
		UUID id = createdId(token, "Disposable " + System.nanoTime());

		mockMvc.perform(delete("/api/exercises/" + id).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(40)));
	}

	@Test
	void deleteIsRefusedWhenUsedInPlan() throws Exception {
		User owner = newUser();
		String token = bearer(owner);
		UUID id = createdId(token, "Planned " + System.nanoTime());
		TrainingPlan plan = new TrainingPlan(owner.getId(), "Plan");
		plan.replaceEntries(List.of(new PlanEntryInput(id, 3, 10)));
		planRepository.save(plan);

		mockMvc.perform(delete("/api/exercises/" + id).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_IN_USE")))
			.andExpect(jsonPath("$.error", notNullValue()));
		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(41)));
	}

	@Test
	void deleteIsRefusedWhenUsedInLoggedSet() throws Exception {
		User owner = newUser();
		String token = bearer(owner);
		UUID id = createdId(token, "Logged " + System.nanoTime());
		WorkoutSession session = sessionRepository.save(new WorkoutSession(owner.getId()));
		setRepository.save(new WorkoutSet(session, id, 8, new BigDecimal("20.0")));

		mockMvc.perform(delete("/api/exercises/" + id).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_IN_USE")))
			.andExpect(jsonPath("$.error", notNullValue()));
	}

	@Test
	void deleteOfCatalogForeignOrUnknownExerciseIsNotFound() throws Exception {
		User owner = newUser();
		UUID foreignId = createdId(bearer(owner), "Foreign " + System.nanoTime());
		UUID catalogId = exerciseRepository.findAllByOrderByNameAsc()
			.stream()
			.filter(e -> e.getOwnerId() == null)
			.findFirst()
			.orElseThrow()
			.getId();
		String token = bearer(newUser());

		mockMvc.perform(delete("/api/exercises/" + catalogId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/exercises/" + foreignId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/exercises/" + UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/exercises/not-a-uuid").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isBadRequest());
	}

	@Test
	void updateChangesNameAndMuscleGroupsAndKeepsSlug() throws Exception {
		User owner = newUser();
		String token = bearer(owner);
		String oldName = "Old Name " + System.nanoTime();
		String newName = "New Name " + System.nanoTime();
		String created = create(token, body(oldName, "BICEPS", null)).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		UUID id = UUID.fromString(com.jayway.jsonpath.JsonPath.read(created, "$.id"));
		String slug = com.jayway.jsonpath.JsonPath.read(created, "$.slug");
		TrainingPlan plan = new TrainingPlan(owner.getId(), "Plan");
		plan.replaceEntries(List.of(new PlanEntryInput(id, 3, 10)));
		UUID planId = planRepository.save(plan).getId();

		update(token, id, body("  " + newName + "  ", "CORE", "BICEPS")).andExpect(status().isOk())
			.andExpect(jsonPath("$.id", is(id.toString())))
			.andExpect(jsonPath("$.custom", is(true)))
			.andExpect(jsonPath("$.name", is(newName)))
			.andExpect(jsonPath("$.slug", is(slug)))
			.andExpect(jsonPath("$.primaryMuscleGroup", is("CORE")))
			.andExpect(jsonPath("$.secondaryMuscleGroups", contains("BICEPS")));

		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$", hasSize(41)))
			.andExpect(jsonPath("$[?(@.id == '" + id + "')].name", contains(newName)))
			.andExpect(jsonPath("$[?(@.id == '" + id + "')].primaryMuscleGroup", contains("CORE")))
			.andExpect(jsonPath("$[*].name", not(hasItem(oldName))));
		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.exercises[0].exerciseName", is(newName)));
	}

	@Test
	void updateAllowsKeepingOrRecasingOwnName() throws Exception {
		String token = bearer(newUser());
		String name = "Same Name " + System.nanoTime();
		UUID id = createdId(token, name);

		update(token, id, body(name, "BACK", null)).andExpect(status().isOk())
			.andExpect(jsonPath("$.name", is(name)))
			.andExpect(jsonPath("$.primaryMuscleGroup", is("BACK")));
		update(token, id, body(name.toUpperCase(), "BACK", null)).andExpect(status().isOk())
			.andExpect(jsonPath("$.name", is(name.toUpperCase())));
	}

	@Test
	void updateToTakenNameIsConflict() throws Exception {
		String token = bearer(newUser());
		String other = "Other " + System.nanoTime();
		createdId(token, other);
		UUID id = createdId(token, "Mine " + System.nanoTime());

		update(token, id, body(other.toUpperCase(), "BICEPS", null)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_NAME_TAKEN")))
			.andExpect(jsonPath("$.error", notNullValue()));
		update(token, id, body(" Barbell ROW ", "BACK", null)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.code", is("EXERCISE_NAME_TAKEN")));
	}

	@Test
	void updateOfForeignPreloadedOrUnknownExerciseIsNotFound() throws Exception {
		UUID foreignId = createdId(bearer(newUser()), "Foreign " + System.nanoTime());
		UUID catalogId = exerciseRepository.findAllByOrderByNameAsc()
			.stream()
			.filter(e -> e.getOwnerId() == null)
			.findFirst()
			.orElseThrow()
			.getId();
		String token = bearer(newUser());

		for (UUID id : List.of(foreignId, catalogId, UUID.randomUUID())) {
			update(token, id, body("Renamed " + System.nanoTime(), "BICEPS", null)).andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code", is("EXERCISE_NOT_FOUND")))
				.andExpect(jsonPath("$.error", notNullValue()));
		}
	}

	@Test
	void updateWithInvalidBodyReturnsBadRequest() throws Exception {
		String token = bearer(newUser());
		UUID id = createdId(token, "Valid " + System.nanoTime());

		update(token, id, body("   ", "BICEPS", null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("name")))
			.andExpect(jsonPath("$.rule", is("NotBlank")));
		update(token, id, body("No Group", null, null)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code", is("VALIDATION_FAILED")))
			.andExpect(jsonPath("$.field", is("primaryMuscleGroup")))
			.andExpect(jsonPath("$.rule", is("NotNull")));
		update(token, id, body("Same Group", "BICEPS", "BICEPS")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.field", is("secondaryMuscleGroupsExcludePrimary")))
			.andExpect(jsonPath("$.rule", is("AssertTrue")));
	}

	@Test
	void updateWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(put("/api/exercises/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON)
			.content(body("Anon", "BICEPS", null))).andExpect(status().isUnauthorized());
	}

	@Test
	void createAndDeleteWithoutTokenReturnUnauthorized() throws Exception {
		mockMvc.perform(post("/api/exercises").contentType(MediaType.APPLICATION_JSON)
			.content(body("Anon", "BICEPS", null))).andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/exercises/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
	}

}
