package com.example.gymtrack.exercise;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class ExerciseSeedTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private ExerciseRepository exerciseRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void seedHasFortyExercisesWithUniqueSlugs() {
		List<Exercise> exercises = exerciseRepository.findAll();

		assertThat(exercises).hasSize(40);
		assertThat(exercises.stream().map(Exercise::getSlug).distinct()).hasSize(40);
	}

	@Test
	void everyMuscleGroupHasAtLeastThreePrimaryExercises() {
		var countsByGroup = exerciseRepository.findAll().stream()
				.collect(Collectors.groupingBy(Exercise::getPrimaryMuscleGroup, Collectors.counting()));

		for (MuscleGroup group : MuscleGroup.values()) {
			assertThat(countsByGroup.getOrDefault(group, 0L)).as(group.name()).isGreaterThanOrEqualTo(3);
		}
	}

	@Test
	void noExerciseListsItsPrimaryGroupAsSecondary() {
		for (Exercise exercise : exerciseRepository.findAll()) {
			assertThat(exercise.getSecondaryMuscleGroups()).as(exercise.getSlug())
					.doesNotContain(exercise.getPrimaryMuscleGroup());
		}
	}

	@Test
	void everyStoredGroupStringMapsToAMuscleGroup() {
		List<String> stored = jdbcTemplate.queryForList("""
				select primary_muscle_group from exercises
				union
				select muscle_group from exercise_secondary_muscle_groups
				""", String.class);
		List<String> known = Arrays.stream(MuscleGroup.values()).map(Enum::name).toList();

		assertThat(stored).isNotEmpty().isSubsetOf(known);
	}

}
