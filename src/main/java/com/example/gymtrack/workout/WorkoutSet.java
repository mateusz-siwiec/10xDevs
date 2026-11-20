package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "workout_sets")
public class WorkoutSet {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "session_id", nullable = false)
	private WorkoutSession session;

	@Column(nullable = false)
	private UUID exerciseId;

	@Column
	private Integer reps;

	@Column
	private Integer durationSeconds;

	@Column(nullable = false, precision = 6, scale = 2)
	private BigDecimal weightKg;

	@Column(nullable = false)
	private Instant loggedAt;

	@Column(nullable = false)
	private boolean toFailure;

	protected WorkoutSet() {
	}

	public WorkoutSet(WorkoutSession session, UUID exerciseId, int reps, BigDecimal weightKg) {
		this(session, exerciseId, reps, weightKg, false);
	}

	public WorkoutSet(WorkoutSession session, UUID exerciseId, int reps, BigDecimal weightKg, boolean toFailure) {
		this(session, exerciseId, Integer.valueOf(reps), null, weightKg, toFailure);
	}

	/** Exactly one of {@code reps} and {@code durationSeconds} is set. */
	public WorkoutSet(WorkoutSession session, UUID exerciseId, Integer reps, Integer durationSeconds,
			BigDecimal weightKg, boolean toFailure) {
		this.session = session;
		this.exerciseId = exerciseId;
		this.reps = reps;
		this.durationSeconds = durationSeconds;
		this.weightKg = weightKg;
		this.toFailure = toFailure;
		this.loggedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public WorkoutSession getSession() {
		return session;
	}

	public UUID getExerciseId() {
		return exerciseId;
	}

	/** Null for a duration set. */
	public Integer getReps() {
		return reps;
	}

	/** Null for a rep set. */
	public Integer getDurationSeconds() {
		return durationSeconds;
	}

	public BigDecimal getWeightKg() {
		return weightKg;
	}

	public Instant getLoggedAt() {
		return loggedAt;
	}

	public boolean isToFailure() {
		return toFailure;
	}

}
