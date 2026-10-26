package com.example.gymtrack.plan;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
import com.example.gymtrack.exercise.Exercise;
import com.example.gymtrack.exercise.ExerciseRepository;
import com.example.gymtrack.user.User;
import com.example.gymtrack.user.UserRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
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
class TrainingPlanControllerTest {

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

	private final List<User> createdUsers = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		for (User user : createdUsers) {
			planRepository.deleteAll(planRepository.findByUserIdOrderByUpdatedAtDesc(user.getId()));
		}
		userRepository.deleteAll(createdUsers);
		createdUsers.clear();
	}

	private String bearerToken() {
		User user = userRepository.save(new User("plans-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		createdUsers.add(user);
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	private List<UUID> exerciseIds(int count) {
		return exerciseRepository.findAllByOrderByNameAsc().stream().limit(count).map(Exercise::getId).toList();
	}

	private String body(String name, List<?> ids) {
		String idList = ids.stream().map(id -> id == null ? "null" : "\"" + id + "\"").collect(Collectors.joining(","));
		return "{\"name\":\"" + name + "\",\"exerciseIds\":[" + idList + "]}";
	}

	private String createPlan(String token, String name, List<UUID> ids) throws Exception {
		String response = mockMvc.perform(post("/api/training-plans")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body(name, ids)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(response, "$.id");
	}

	@Test
	void routesWithoutTokenReturnUnauthorized() throws Exception {
		UUID id = UUID.randomUUID();
		String json = body("Push", exerciseIds(1));
		mockMvc.perform(get("/api/training-plans")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/training-plans/" + id)).andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/training-plans").contentType(MediaType.APPLICATION_JSON).content(json))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(put("/api/training-plans/" + id).contentType(MediaType.APPLICATION_JSON).content(json))
			.andExpect(status().isUnauthorized());
		mockMvc.perform(delete("/api/training-plans/" + id)).andExpect(status().isUnauthorized());
	}

	@Test
	void createReturnsEntriesInRequestOrderWithPositions() throws Exception {
		String token = bearerToken();
		List<UUID> ids = exerciseIds(3);
		List<UUID> reordered = List.of(ids.get(2), ids.get(0), ids.get(1));

		mockMvc.perform(post("/api/training-plans")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Push day", reordered)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id", notNullValue()))
			.andExpect(jsonPath("$.name", is("Push day")))
			.andExpect(jsonPath("$.exercises", hasSize(3)))
			.andExpect(jsonPath("$.exercises[0].exerciseId", is(reordered.get(0).toString())))
			.andExpect(jsonPath("$.exercises[0].exerciseName", notNullValue()))
			.andExpect(jsonPath("$.exercises[0].position", is(0)))
			.andExpect(jsonPath("$.exercises[1].exerciseId", is(reordered.get(1).toString())))
			.andExpect(jsonPath("$.exercises[1].position", is(1)))
			.andExpect(jsonPath("$.exercises[2].exerciseId", is(reordered.get(2).toString())))
			.andExpect(jsonPath("$.exercises[2].position", is(2)));
	}

	@Test
	void duplicateExercisesArePreserved() throws Exception {
		String token = bearerToken();
		UUID id = exerciseIds(1).get(0);
		String planId = createPlan(token, "Dupes", List.of(id, id, id));

		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.exercises", hasSize(3)))
			.andExpect(jsonPath("$.exercises[2].exerciseId", is(id.toString())))
			.andExpect(jsonPath("$.exercises[2].position", is(2)));
	}

	@Test
	void putReordersAndRemovesEntriesLeavingNoStaleOnes() throws Exception {
		String token = bearerToken();
		List<UUID> ids = exerciseIds(3);
		String planId = createPlan(token, "Original", ids);

		mockMvc.perform(put("/api/training-plans/" + planId)
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Renamed", List.of(ids.get(1), ids.get(0)))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name", is("Renamed")))
			.andExpect(jsonPath("$.exercises", hasSize(2)))
			.andExpect(jsonPath("$.exercises[0].exerciseId", is(ids.get(1).toString())))
			.andExpect(jsonPath("$.exercises[1].exerciseId", is(ids.get(0).toString())));

		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.name", is("Renamed")))
			.andExpect(jsonPath("$.exercises", hasSize(2)))
			.andExpect(jsonPath("$.exercises[0].exerciseId", is(ids.get(1).toString())))
			.andExpect(jsonPath("$.exercises[0].position", is(0)))
			.andExpect(jsonPath("$.exercises[1].exerciseId", is(ids.get(0).toString())))
			.andExpect(jsonPath("$.exercises[1].position", is(1)));
	}

	@Test
	void listReturnsOnlyCallersPlansMostRecentlyUpdatedFirst() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		List<UUID> ids = exerciseIds(2);
		String first = createPlan(tokenA, "First", ids);
		String second = createPlan(tokenA, "Second", ids);
		createPlan(tokenB, "Other", ids);

		mockMvc.perform(get("/api/training-plans").header(HttpHeaders.AUTHORIZATION, tokenA))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].id", is(second)))
			.andExpect(jsonPath("$[0].exerciseCount", is(2)))
			.andExpect(jsonPath("$[1].id", is(first)));

		mockMvc.perform(put("/api/training-plans/" + first)
				.header(HttpHeaders.AUTHORIZATION, tokenA)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("First", ids.subList(0, 1))))
			.andExpect(status().isOk());

		mockMvc.perform(get("/api/training-plans").header(HttpHeaders.AUTHORIZATION, tokenA))
			.andExpect(jsonPath("$[0].id", is(first)))
			.andExpect(jsonPath("$[0].exerciseCount", is(1)))
			.andExpect(jsonPath("$[0].updatedAt", notNullValue()));
	}

	@Test
	void otherUserGetsNotFoundOnGetPutDelete() throws Exception {
		String tokenA = bearerToken();
		String tokenB = bearerToken();
		List<UUID> ids = exerciseIds(1);
		String planId = createPlan(tokenA, "Mine", ids);

		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.error", notNullValue()));
		mockMvc.perform(put("/api/training-plans/" + planId)
				.header(HttpHeaders.AUTHORIZATION, tokenB)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Hijack", ids)))
			.andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, tokenB))
			.andExpect(status().isNotFound());

		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, tokenA))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name", is("Mine")));
	}

	@Test
	void deleteRemovesPlanThenReadReturnsNotFound() throws Exception {
		String token = bearerToken();
		String planId = createPlan(token, "Temp", exerciseIds(2));

		mockMvc.perform(delete("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNoContent());
		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(status().isNotFound());
	}

	@Test
	void invalidRequestsReturnBadRequest() throws Exception {
		String token = bearerToken();
		List<UUID> ids = exerciseIds(1);
		List<UUID> fiftyOne = new ArrayList<>();
		for (int i = 0; i < 51; i++) {
			fiftyOne.add(ids.get(0));
		}
		List<Object> withNull = new ArrayList<>();
		withNull.add(ids.get(0));
		withNull.add(null);

		String[] badBodies = {
			body("   ", ids),
			body("x".repeat(61), ids),
			body("Plan", List.of()),
			body("Plan", fiftyOne),
			body("Plan", withNull),
			"{\"name\":\"Plan\"}",
		};
		for (String json : badBodies) {
			mockMvc.perform(post("/api/training-plans")
					.header(HttpHeaders.AUTHORIZATION, token)
					.contentType(MediaType.APPLICATION_JSON)
					.content(json))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error", notNullValue()));
		}
	}

	@Test
	void unknownExerciseReturnsNotFoundOnCreateAndReplace() throws Exception {
		String token = bearerToken();
		List<UUID> ids = exerciseIds(1);
		String planId = createPlan(token, "Real", ids);
		List<UUID> unknown = List.of(ids.get(0), UUID.randomUUID());

		mockMvc.perform(post("/api/training-plans")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Bad", unknown)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.error", is("Exercise not found")));
		mockMvc.perform(put("/api/training-plans/" + planId)
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("Bad", unknown)))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.error", is("Exercise not found")));

		mockMvc.perform(get("/api/training-plans/" + planId).header(HttpHeaders.AUTHORIZATION, token))
			.andExpect(jsonPath("$.name", is("Real")))
			.andExpect(jsonPath("$.exercises", hasSize(1)));
	}

	@Test
	void nameIsStoredTrimmed() throws Exception {
		String token = bearerToken();
		List<UUID> ids = exerciseIds(1);

		mockMvc.perform(post("/api/training-plans")
				.header(HttpHeaders.AUTHORIZATION, token)
				.contentType(MediaType.APPLICATION_JSON)
				.content(body("  Leg day  ", ids)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.name", is("Leg day")));
	}

}
