package com.example.gymtrack.exercise;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.gymtrack.auth.JwtService;
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
class ExerciseControllerTest {

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
		User user = userRepository.save(new User("exercises-" + System.nanoTime() + "@example.com",
				passwordEncoder.encode("password123")));
		return "Bearer " + jwtService.generateToken(user.getId(), user.getEmail());
	}

	@Test
	void listWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/exercises"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void listReturnsAllSeededExercisesWithAllFields() throws Exception {
		mockMvc.perform(get("/api/exercises").header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(40)))
			.andExpect(jsonPath("$[*].id", everyItem(notNullValue())))
			.andExpect(jsonPath("$[*].slug", everyItem(notNullValue())))
			.andExpect(jsonPath("$[*].name", everyItem(notNullValue())))
			.andExpect(jsonPath("$[*].primaryMuscleGroup", everyItem(notNullValue())))
			.andExpect(jsonPath("$[*].secondaryMuscleGroups", everyItem(notNullValue())));
	}

	@Test
	void muscleGroupFilterReturnsOnlyExercisesWithThatPrimaryGroup() throws Exception {
		mockMvc.perform(get("/api/exercises").param("muscleGroup", "CHEST")
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(4)))
			.andExpect(jsonPath("$[*].primaryMuscleGroup", everyItem(is("CHEST"))));
	}

	@Test
	void unknownMuscleGroupReturnsBadRequest() throws Exception {
		mockMvc.perform(get("/api/exercises").param("muscleGroup", "NOPE")
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest());
	}

	@Test
	void substitutesWithoutTokenReturnsUnauthorized() throws Exception {
		mockMvc.perform(get("/api/exercises/{id}/substitutes", UUID.randomUUID()))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void substitutesReturnsOtherExercisesOfSamePrimaryGroupOrderedByName() throws Exception {
		List<Exercise> chest = exerciseRepository.findByPrimaryMuscleGroupOrderByNameAsc(MuscleGroup.CHEST);
		Exercise requested = chest.get(1);
		String[] expectedNames = chest.stream()
			.filter(e -> !e.getId().equals(requested.getId()))
			.map(Exercise::getName)
			.sorted(String.CASE_INSENSITIVE_ORDER)
			.toArray(String[]::new);

		mockMvc.perform(get("/api/exercises/{id}/substitutes", requested.getId())
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(chest.size() - 1)))
			.andExpect(jsonPath("$[*].primaryMuscleGroup", everyItem(is("CHEST"))))
			.andExpect(jsonPath("$[*].id", not(hasItem(requested.getId().toString()))))
			.andExpect(jsonPath("$[*].name", contains(expectedNames)));
	}

	@Test
	void substitutesForUnknownExerciseReturnsNotFound() throws Exception {
		mockMvc.perform(get("/api/exercises/{id}/substitutes", UUID.randomUUID())
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isNotFound());
	}

	@Test
	void substitutesWithMalformedExerciseIdReturnsBadRequest() throws Exception {
		mockMvc.perform(get("/api/exercises/{id}/substitutes", "not-a-uuid")
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isBadRequest());
	}

	@Test
	void deadliftReturnsItsSecondaryMuscleGroups() throws Exception {
		mockMvc.perform(get("/api/exercises").param("muscleGroup", "BACK")
				.header(HttpHeaders.AUTHORIZATION, bearerToken()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.slug == 'deadlift')].secondaryMuscleGroups[*]",
					containsInAnyOrder("HAMSTRINGS", "GLUTES")));
	}

}
