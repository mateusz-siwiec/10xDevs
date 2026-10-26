package com.example.gymtrack.workout;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "workout_sessions")
public class WorkoutSession {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private UUID userId;

	@Column(nullable = false)
	private Instant startedAt;

	private Instant endedAt;

	protected WorkoutSession() {
	}

	public WorkoutSession(UUID userId) {
		this.userId = userId;
		this.startedAt = Instant.now();
	}

	public void end() {
		this.endedAt = Instant.now();
	}

	public boolean isActive() {
		return endedAt == null;
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public Instant getStartedAt() {
		return startedAt;
	}

	public Instant getEndedAt() {
		return endedAt;
	}

}
