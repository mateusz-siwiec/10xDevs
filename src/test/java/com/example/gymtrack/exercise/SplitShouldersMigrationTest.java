package com.example.gymtrack.exercise;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
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
 * Runs the migrations up to V11, inserts custom exercises that still use SHOULDERS, then migrates to the latest
 * version. Deliberately plain Flyway (no Spring context) so nothing auto-migrates before the data is in place.
 */
@Testcontainers
class SplitShouldersMigrationTest {

	@Container
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Test
	void customShouldersDataIsConvertedAndNoShouldersRemain() {
		DataSource dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(),
				postgres.getPassword());
		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("11").load().migrate();
		JdbcTemplate jdbc = new JdbcTemplate(dataSource);

		UUID userId = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", userId,
				"split-shoulders@example.com", "hash");
		UUID shouldersPrimary = custom(jdbc, userId, "Custom Shoulders Primary", "SHOULDERS");
		UUID shouldersSecondary = custom(jdbc, userId, "Custom Shoulders Secondary", "CHEST");
		UUID shouldersBoth = custom(jdbc, userId, "Custom Shoulders And Triceps", "SHOULDERS");
		secondary(jdbc, shouldersSecondary, "SHOULDERS");
		secondary(jdbc, shouldersBoth, "TRICEPS");

		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

		assertThat(primary(jdbc, shouldersPrimary)).isEqualTo("SIDE_DELTS");
		assertThat(secondaries(jdbc, shouldersPrimary)).isEmpty();
		assertThat(primary(jdbc, shouldersSecondary)).isEqualTo("MID_CHEST");
		assertThat(secondaries(jdbc, shouldersSecondary)).containsExactly("FRONT_DELTS");
		assertThat(primary(jdbc, shouldersBoth)).isEqualTo("SIDE_DELTS");
		assertThat(secondaries(jdbc, shouldersBoth)).containsExactly("TRICEPS");

		assertThat(jdbc.queryForObject("select count(*) from exercises where primary_muscle_group = 'SHOULDERS'",
				Integer.class)).isZero();
		assertThat(jdbc.queryForObject(
				"select count(*) from exercise_secondary_muscle_groups where muscle_group = 'SHOULDERS'",
				Integer.class)).isZero();
		// The catalogue rows added by V12 are shared (no owner); the total catalogue size is ExerciseSeedTest's concern.
		assertThat(jdbc.queryForObject("""
				select count(*) from exercises where owner_id is null and slug in (
				    'hip-adduction-machine', 'copenhagen-plank', 'hip-abduction-machine', 'banded-lateral-walk',
				    'reverse-pec-deck', 'bent-over-rear-delt-fly', 'front-raise', 'cable-lateral-raise')
				""", Integer.class)).isEqualTo(8);
	}

	private static UUID custom(JdbcTemplate jdbc, UUID ownerId, String name, String primary) {
		UUID id = UUID.randomUUID();
		jdbc.update("insert into exercises (id, slug, name, primary_muscle_group, owner_id) values (?, ?, ?, ?, ?)", id,
				"custom-" + id, name, primary, ownerId);
		return id;
	}

	private static void secondary(JdbcTemplate jdbc, UUID exerciseId, String group) {
		jdbc.update("insert into exercise_secondary_muscle_groups (exercise_id, muscle_group) values (?, ?)",
				exerciseId, group);
	}

	private static String primary(JdbcTemplate jdbc, UUID id) {
		return jdbc.queryForObject("select primary_muscle_group from exercises where id = ?", String.class, id);
	}

	private static List<String> secondaries(JdbcTemplate jdbc, UUID id) {
		return jdbc.queryForList("select muscle_group from exercise_secondary_muscle_groups where exercise_id = ?",
				String.class, id);
	}

}
