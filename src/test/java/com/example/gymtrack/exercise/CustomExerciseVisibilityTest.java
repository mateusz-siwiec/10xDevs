package com.example.gymtrack.exercise;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
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
class CustomExerciseVisibilityTest {

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
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtService jwtService;

	private User newUser() {
		return userRepository.save(new User("visibility-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
	}

	private String bearer(User user) {
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private UUID createCustom(String token, String name, String primary) throws Exception {
		String json = mockMvc
			.perform(post("/api/exercises").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"name\":\"" + name + "\",\"primaryMuscleGroup\":\"" + primary
						+ "\",\"secondaryMuscleGroups\":[]}"))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return UUID.fromString(com.jayway.jsonpath.JsonPath.read(json, "$.id"));
	}

	private UUID startSession(String token) throws Exception {
		String json = mockMvc
			.perform(post("/api/workout-sessions").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().is2xxSuccessful())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return UUID.fromString(com.jayway.jsonpath.JsonPath.read(json, "$.id"));
	}

	private ResultActions logSet(String token, UUID sessionId, UUID exerciseId) throws Exception {
		return mockMvc.perform(post("/api/workout-sessions/" + sessionId + "/sets")
			.header(HttpHeaders.AUTHORIZATION, token)
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"exerciseId\":\"" + exerciseId + "\",\"reps\":8,\"weightKg\":20.0}"));
	}

	private static String planBody(UUID exerciseId) {
		return "{\"name\":\"Plan\",\"entries\":[{\"exerciseId\":\"" + exerciseId + "\",\"sets\":3,\"reps\":10}]}";
	}

	private UUID catalogId(MuscleGroup group, boolean same) {
		return exerciseRepository.findAllByOrderByNameAsc()
			.stream()
			.filter(e -> e.getOwnerId() == null && ((e.getPrimaryMuscleGroup() == group) == same))
			.findFirst()
			.orElseThrow()
			.getId();
	}

	@Test
	void foreignCustomExerciseIsNotFoundOnEveryExerciseIdPath() throws Exception {
		User owner = newUser();
		User other = newUser();
		UUID foreignId = createCustom(bearer(owner), "Foreign " + System.nanoTime(), "BICEPS");
		String token = bearer(other);
		UUID sessionId = startSession(token);

		logSet(token, sessionId, foreignId).andExpect(status().isNotFound());
		mockMvc.perform(get("/api/exercises/" + foreignId + "/progression").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc
			.perform(get("/api/exercises/" + foreignId + "/progression-recommendation")
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc
			.perform(get("/api/exercises/" + foreignId + "/previous-workout").param("planId", UUID.randomUUID().toString())
				.header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
		mockMvc
			.perform(post("/api/training-plans").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(planBody(foreignId)))
			.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/exercises/" + foreignId + "/substitutes").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());

		UUID catalogId = catalogId(MuscleGroup.BICEPS, true);
		TrainingPlan plan = new TrainingPlan(other.getId(), "Existing");
		plan.replaceEntries(List.of(new PlanEntryInput(catalogId, 3, 10)));
		UUID planId = planRepository.save(plan).getId();
		mockMvc
			.perform(put("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(planBody(foreignId)))
			.andExpect(status().isNotFound());
	}

	@Test
	void ownerCanUseOwnCustomExerciseEverywhere() throws Exception {
		User owner = newUser();
		String token = bearer(owner);
		UUID id = createCustom(token, "Mine " + System.nanoTime(), "BICEPS");
		UUID sessionId = startSession(token);

		logSet(token, sessionId, id).andExpect(status().isCreated());
		mockMvc.perform(get("/api/exercises/" + id + "/progression").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk());
		mockMvc.perform(get("/api/exercises/" + id + "/progression-recommendation")
			.header(HttpHeaders.AUTHORIZATION, token)).andExpect(status().is2xxSuccessful());

		String planJson = mockMvc
			.perform(post("/api/training-plans").header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(planBody(id)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		String planId = com.jayway.jsonpath.JsonPath.read(planJson, "$.id");
		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.exercises", hasSize(1)));
	}

	@Test
	void ownProgressionOfFreshCustomExerciseIsEmpty() throws Exception {
		String token = bearer(newUser());
		UUID id = createCustom(token, "Empty " + System.nanoTime(), "BICEPS");

		mockMvc.perform(get("/api/exercises/" + id + "/progression").header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(0)));
	}

	@Test
	void substitutesIncludeOnlyCallersOwnCustomExercisesOfTheSameGroup() throws Exception {
		User owner = newUser();
		User other = newUser();
		String name = "Sub Curl " + System.nanoTime();
		UUID customId = createCustom(bearer(owner), name, "BICEPS");
		UUID bicepsCatalog = catalogId(MuscleGroup.BICEPS, true);
		UUID otherGroupCatalog = catalogId(MuscleGroup.BICEPS, false);

		mockMvc.perform(get("/api/exercises/" + bicepsCatalog + "/substitutes")
			.header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", hasItem(customId.toString())))
			.andExpect(jsonPath("$[*].id", not(hasItem(bicepsCatalog.toString()))));
		mockMvc.perform(get("/api/exercises/" + otherGroupCatalog + "/substitutes")
			.header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", not(hasItem(customId.toString()))));
		mockMvc.perform(get("/api/exercises/" + bicepsCatalog + "/substitutes")
			.header(HttpHeaders.AUTHORIZATION, bearer(other)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[*].id", not(hasItem(customId.toString()))));
		mockMvc.perform(get("/api/exercises/" + UUID.randomUUID() + "/substitutes")
			.header(HttpHeaders.AUTHORIZATION, bearer(owner)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code", is("EXERCISE_NOT_FOUND")))
			.andExpect(jsonPath("$.error", is("Exercise not found")));
	}

}
