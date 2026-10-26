package com.example.gymtrack.plan;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "training_plans")
public class TrainingPlan {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false)
	private UUID userId;

	@Column(nullable = false, length = 60)
	private String name;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	@OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("position")
	private List<TrainingPlanEntry> entries = new ArrayList<>();

	protected TrainingPlan() {
	}

	public TrainingPlan(UUID userId, String name) {
		this.userId = userId;
		this.name = name;
		this.createdAt = Instant.now();
		this.updatedAt = this.createdAt;
	}

	public void rename(String name) {
		this.name = name;
		this.updatedAt = Instant.now();
	}

	/**
	 * Replaces all entries, assigning positions 0..n-1 in list order. Note: (plan_id, position) is
	 * unique and Hibernate flushes inserts before deletes, so if this plan is already persisted the
	 * caller must flush between clearing the old entries and re-adding (e.g. call
	 * {@code replaceEntries(List.of())}, flush, then {@code replaceEntries(newEntries)}).
	 */
	public void replaceEntries(List<PlanEntryInput> inputs) {
		entries.clear();
		for (int i = 0; i < inputs.size(); i++) {
			PlanEntryInput input = inputs.get(i);
			entries.add(new TrainingPlanEntry(this, input.exerciseId(), i, input.sets(), input.reps()));
		}
		this.updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getUserId() {
		return userId;
	}

	public String getName() {
		return name;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public List<TrainingPlanEntry> getEntries() {
		return entries;
	}

}
