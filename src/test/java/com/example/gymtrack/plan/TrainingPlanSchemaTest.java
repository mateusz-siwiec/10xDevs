package com.example.gymtrack.plan;

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
class TrainingPlanSchemaTest {

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
		jdbc.update("delete from training_plans where user_id = ?", userId);
		jdbc.update("delete from users where id = ?", userId);
	}

	private UUID insertPlan() {
		UUID id = UUID.randomUUID();
		jdbc.update("insert into training_plans (id, user_id, name, created_at, updated_at) "
				+ "values (?, ?, ?, now(), now())", id, userId, "Plan");
		return id;
	}

	private void insertEntry(UUID planId, UUID exercise, int position) {
		jdbc.update("insert into training_plan_entries (id, plan_id, exercise_id, position) values (?, ?, ?, ?)",
				UUID.randomUUID(), planId, exercise, position);
	}

	@Test
	void duplicatePositionInSamePlanIsRejected() {
		UUID planId = insertPlan();
		insertEntry(planId, exerciseId, 0);

		assertThatThrownBy(() -> insertEntry(planId, exerciseId, 0))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void negativePositionIsRejected() {
		UUID planId = insertPlan();

		assertThatThrownBy(() -> insertEntry(planId, exerciseId, -1))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletingPlanCascadesItsEntries() {
		UUID planId = insertPlan();
		insertEntry(planId, exerciseId, 0);
		insertEntry(planId, exerciseId, 1);

		jdbc.update("delete from training_plans where id = ?", planId);

		Integer remaining = jdbc.queryForObject("select count(*) from training_plan_entries where plan_id = ?",
				Integer.class, planId);
		assertThat(remaining).isZero();
	}

	@Test
	void unknownExerciseIsRejected() {
		UUID planId = insertPlan();

		assertThatThrownBy(() -> insertEntry(planId, UUID.randomUUID(), 0))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

}
