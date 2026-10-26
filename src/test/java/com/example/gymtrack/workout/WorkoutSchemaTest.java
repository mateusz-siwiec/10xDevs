package com.example.gymtrack.workout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@TestPropertySource(properties = "JWT_SECRET=integration-test-signing-key-at-least-256-bits-long")
class WorkoutSchemaTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private JdbcTemplate jdbc;

	private UUID userId;

	private UUID exerciseId;

	@BeforeEach
	void setUp() {
		userId = UUID.randomUUID();
		jdbc.update("insert into users (id, email, password_hash) values (?, ?, ?)", userId,
				userId + "@example.com", "hash");
		exerciseId = jdbc.queryForObject("select id from exercises limit 1", UUID.class);
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from workout_sessions where user_id = ?", userId);
		jdbc.update("delete from users where id = ?", userId);
	}

	private UUID insertSession(boolean ended) {
		UUID id = UUID.randomUUID();
		jdbc.update("insert into workout_sessions (id, user_id, started_at, ended_at) values (?, ?, now(), "
				+ (ended ? "now()" : "null") + ")", id, userId);
		return id;
	}

	private void insertSet(UUID sessionId, int reps, double weightKg) {
		jdbc.update("insert into workout_sets (id, session_id, exercise_id, reps, weight_kg, logged_at) "
				+ "values (?, ?, ?, ?, ?, now())", UUID.randomUUID(), sessionId, exerciseId, reps, weightKg);
	}

	@Test
	void secondActiveSessionForSameUserIsRejected() {
		insertSession(false);

		assertThatThrownBy(() -> insertSession(false)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void endedSessionAllowsNewActiveOne() {
		insertSession(true);

		insertSession(false);

		Integer active = jdbc.queryForObject(
				"select count(*) from workout_sessions where user_id = ? and ended_at is null", Integer.class,
				userId);
		assertThat(active).isEqualTo(1);
	}

	@Test
	void zeroRepsIsRejected() {
		UUID sessionId = insertSession(false);

		assertThatThrownBy(() -> insertSet(sessionId, 0, 50)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void zeroWeightIsRejected() {
		UUID sessionId = insertSession(false);

		assertThatThrownBy(() -> insertSet(sessionId, 5, 0)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletingSessionCascadesItsSets() {
		UUID sessionId = insertSession(false);
		insertSet(sessionId, 5, 60);
		insertSet(sessionId, 8, 52.5);

		jdbc.update("delete from workout_sessions where id = ?", sessionId);

		Integer remaining = jdbc.queryForObject("select count(*) from workout_sets where session_id = ?",
				Integer.class, sessionId);
		assertThat(remaining).isZero();
	}

}
