package com.example.gymtrack.plan;

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
@Table(name = "training_plan_entries")
public class TrainingPlanEntry {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "plan_id", nullable = false)
	private TrainingPlan plan;

	@Column(nullable = false)
	private UUID exerciseId;

	@Column(nullable = false)
	private int position;

	protected TrainingPlanEntry() {
	}

	public TrainingPlanEntry(TrainingPlan plan, UUID exerciseId, int position) {
		this.plan = plan;
		this.exerciseId = exerciseId;
		this.position = position;
	}

	public UUID getId() {
		return id;
	}

	public TrainingPlan getPlan() {
		return plan;
	}

	public UUID getExerciseId() {
		return exerciseId;
	}

	public int getPosition() {
		return position;
	}

}
