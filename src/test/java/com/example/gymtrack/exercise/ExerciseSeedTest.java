package com.example.gymtrack.exercise;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
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

		// LOWER_BACK, TRAPS, FOREARMS and OBLIQUES were introduced by V10 (split of BACK and CORE) and have no
		// dedicated catalog exercises yet; every other group (including ABS, formerly CORE) already had at
		// least three.
		Set<MuscleGroup> introducedByV10 = EnumSet.of(MuscleGroup.LOWER_BACK, MuscleGroup.TRAPS,
				MuscleGroup.FOREARMS, MuscleGroup.OBLIQUES);

		for (MuscleGroup group : MuscleGroup.values()) {
			if (introducedByV10.contains(group)) {
				continue;
			}
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
	void splitBackMigrationRemapsBuiltInExercisesBySlug() {
		assertPrimary("deadlift", MuscleGroup.LOWER_BACK);
		assertPrimary("pull-up", MuscleGroup.LATS);
		assertPrimary("barbell-row", MuscleGroup.LATS);
		assertPrimary("lat-pulldown", MuscleGroup.LATS);

		assertSecondaries("face-pull", MuscleGroup.TRAPS);
		assertSecondaries("romanian-deadlift", MuscleGroup.GLUTES, MuscleGroup.LOWER_BACK);
		assertSecondaries("good-morning", MuscleGroup.GLUTES, MuscleGroup.LOWER_BACK);
		assertSecondaries("hanging-leg-raise", MuscleGroup.FOREARMS);
		assertSecondaries("barbell-row", MuscleGroup.BICEPS, MuscleGroup.TRAPS, MuscleGroup.FOREARMS);
		assertSecondaries("pull-up", MuscleGroup.BICEPS, MuscleGroup.FOREARMS);
		assertSecondaries("deadlift", MuscleGroup.HAMSTRINGS, MuscleGroup.GLUTES, MuscleGroup.TRAPS,
				MuscleGroup.FOREARMS);
		assertSecondaries("hammer-curl", MuscleGroup.FOREARMS);
	}

	@Test
	void splitCoreMigrationRemapsBuiltInExercisesBySlug() {
		assertPrimary("plank", MuscleGroup.ABS);
		assertPrimary("hanging-leg-raise", MuscleGroup.ABS);
		assertPrimary("cable-crunch", MuscleGroup.ABS);
		assertPrimary("ab-wheel-rollout", MuscleGroup.ABS);

		assertSecondaries("plank", MuscleGroup.SHOULDERS, MuscleGroup.OBLIQUES);
		assertSecondaries("ab-wheel-rollout", MuscleGroup.SHOULDERS, MuscleGroup.OBLIQUES);
		assertSecondaries("push-up", MuscleGroup.TRICEPS, MuscleGroup.SHOULDERS, MuscleGroup.ABS);
		assertSecondaries("back-squat", MuscleGroup.GLUTES, MuscleGroup.ABS);
		assertSecondaries("front-squat", MuscleGroup.GLUTES, MuscleGroup.ABS);
	}

	@Test
	void noStoredGroupIsARetiredOne() {
		for (String retired : List.of("BACK", "CORE")) {
			Integer primaries = jdbcTemplate.queryForObject(
					"select count(*) from exercises where primary_muscle_group = ?", Integer.class, retired);
			Integer secondaries = jdbcTemplate.queryForObject(
					"select count(*) from exercise_secondary_muscle_groups where muscle_group = ?", Integer.class,
					retired);

			assertThat(primaries).as(retired + " primary").isZero();
			assertThat(secondaries).as(retired + " secondary").isZero();
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

	private void assertPrimary(String slug, MuscleGroup expected) {
		assertThat(bySlug(slug).getPrimaryMuscleGroup()).as(slug).isEqualTo(expected);
	}

	private void assertSecondaries(String slug, MuscleGroup... expected) {
		assertThat(bySlug(slug).getSecondaryMuscleGroups()).as(slug).containsExactlyInAnyOrder(expected);
	}

	private Exercise bySlug(String slug) {
		return exerciseRepository.findAll().stream().filter(e -> e.getSlug().equals(slug)).findFirst()
				.orElseThrow();
	}

}
