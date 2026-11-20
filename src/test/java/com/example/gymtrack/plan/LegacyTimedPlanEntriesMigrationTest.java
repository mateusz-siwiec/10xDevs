package com.example.gymtrack.plan;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs the migrations up to V17, inserts plan entries that still hold Plank (now timed) and Bench Press as rep
 * targets, then migrates to the latest version. Deliberately plain Flyway (no Spring context) so nothing
 * auto-migrates before the data is in place.
 */
@Testcontainers
class LegacyTimedPlanEntriesMigrationTest {

	@Container
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Test
	void repTargetsOfTimedExercisesBecomeSecondsTargetsAndOthersStayUntouched() {
		DataSource dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(),
				postgres.getPassword());
		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("17").load().migrate();
		JdbcTemplate jdbc = new JdbcTemplate(dataSource);

		UUID userId = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", userId,
				"legacy-timed-plan@example.com", "hash");
		UUID planId = UUID.randomUUID();
		jdbc.update("insert into training_plans (id, user_id, name, created_at, updated_at) values (?, ?, ?, now(), now())",
				planId, userId, "Core day");
		UUID plankEntry = entry(jdbc, planId, "plank", 0, 3, 12);
		UUID copenhagenEntry = entry(jdbc, planId, "copenhagen-plank", 1, 2, 8);
		UUID benchEntry = entry(jdbc, planId, "barbell-bench-press", 2, 4, 6);

		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

		assertThat(target(jdbc, plankEntry)).containsEntry("reps", null).containsEntry("target_duration_seconds", 30);
		assertThat(target(jdbc, copenhagenEntry)).containsEntry("reps", null)
			.containsEntry("target_duration_seconds", 30);
		assertThat(target(jdbc, benchEntry)).containsEntry("reps", 6).containsEntry("target_duration_seconds", null);
		assertThat(jdbc.queryForObject("select sets from training_plan_entries where id = ?", Integer.class,
				plankEntry)).isEqualTo(3);
	}

	private static UUID entry(JdbcTemplate jdbc, UUID planId, String slug, int position, int sets, int reps) {
		UUID id = UUID.randomUUID();
		jdbc.update("""
				insert into training_plan_entries (id, plan_id, exercise_id, position, sets, reps)
				select ?, ?, e.id, ?, ?, ? from exercises e where e.slug = ?
				""", id, planId, position, sets, reps, slug);
		return id;
	}

	private static Map<String, Object> target(JdbcTemplate jdbc, UUID entryId) {
		return jdbc.queryForMap("select reps, target_duration_seconds from training_plan_entries where id = ?", entryId);
	}

}
