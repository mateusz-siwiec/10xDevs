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
 * Runs the migrations up to V13, inserts custom exercises that still use CHEST, then migrates to the latest
 * version. Deliberately plain Flyway (no Spring context) so nothing auto-migrates before the data is in place.
 */
@Testcontainers
class SplitChestMigrationTest {

	@Container
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Test
	void customChestDataIsConvertedToMidChestAndNoChestRemains() {
		DataSource dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(),
				postgres.getPassword());
		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target("13").load().migrate();
		JdbcTemplate jdbc = new JdbcTemplate(dataSource);

		UUID userId = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", userId,
				"split-chest@example.com", "hash");
		UUID chestPrimary = custom(jdbc, userId, "Custom Chest Primary", "CHEST");
		UUID chestSecondary = custom(jdbc, userId, "Custom Chest Secondary", "TRICEPS");
		secondary(jdbc, chestSecondary, "CHEST");
		UUID chestBoth = custom(jdbc, userId, "Custom Chest And Triceps", "CHEST");
		secondary(jdbc, chestBoth, "CHEST");
		secondary(jdbc, chestBoth, "TRICEPS");

		Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();

		assertThat(primary(jdbc, chestPrimary)).isEqualTo("MID_CHEST");
		assertThat(secondaries(jdbc, chestPrimary)).isEmpty();
		assertThat(primary(jdbc, chestSecondary)).isEqualTo("TRICEPS");
		assertThat(secondaries(jdbc, chestSecondary)).containsExactly("MID_CHEST");
		assertThat(primary(jdbc, chestBoth)).isEqualTo("MID_CHEST");
		assertThat(secondaries(jdbc, chestBoth)).containsExactly("TRICEPS");

		assertThat(jdbc.queryForObject("select count(*) from exercises where primary_muscle_group = 'CHEST'",
				Integer.class)).isZero();
		assertThat(jdbc.queryForObject(
				"select count(*) from exercise_secondary_muscle_groups where muscle_group = 'CHEST'",
				Integer.class)).isZero();

		assertThat(slugPrimary(jdbc, "incline-dumbbell-press")).isEqualTo("UPPER_CHEST");
		assertThat(slugPrimary(jdbc, "barbell-bench-press")).isEqualTo("MID_CHEST");
		assertThat(slugPrimary(jdbc, "chest-fly")).isEqualTo("MID_CHEST");
		assertThat(slugPrimary(jdbc, "push-up")).isEqualTo("MID_CHEST");
		assertThat(slugPrimary(jdbc, "decline-bench-press")).isEqualTo("LOWER_CHEST");
		assertThat(slugPrimary(jdbc, "chest-dip")).isEqualTo("LOWER_CHEST");
		assertThat(jdbc.queryForList("""
				select s.muscle_group from exercise_secondary_muscle_groups s
				join exercises e on e.id = s.exercise_id where e.slug = 'close-grip-bench-press'
				""", String.class)).containsExactlyInAnyOrder("MID_CHEST", "FRONT_DELTS");
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

	private static String slugPrimary(JdbcTemplate jdbc, String slug) {
		return jdbc.queryForObject("select primary_muscle_group from exercises where slug = ?", String.class, slug);
	}

	private static List<String> secondaries(JdbcTemplate jdbc, UUID id) {
		return jdbc.queryForList("select muscle_group from exercise_secondary_muscle_groups where exercise_id = ?",
				String.class, id);
	}

}
