package com.example.gymtrack.exercise;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

@Entity
@Table(name = "exercises")
public class Exercise {

	@Id
	private UUID id;

	@Column(unique = true, nullable = false)
	private String slug;

	@Column(nullable = false)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private MuscleGroup primaryMuscleGroup;

	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "exercise_secondary_muscle_groups", joinColumns = @JoinColumn(name = "exercise_id"))
	@Column(name = "muscle_group", nullable = false)
	@Enumerated(EnumType.STRING)
	private Set<MuscleGroup> secondaryMuscleGroups = EnumSet.noneOf(MuscleGroup.class);

	@Column(name = "owner_id")
	private UUID ownerId;

	protected Exercise() {
	}

	public Exercise(UUID ownerId, String name, MuscleGroup primaryMuscleGroup,
			Set<MuscleGroup> secondaryMuscleGroups) {
		this.id = UUID.randomUUID();
		this.slug = "custom-" + this.id;
		this.ownerId = ownerId;
		this.name = name;
		this.primaryMuscleGroup = primaryMuscleGroup;
		if (secondaryMuscleGroups != null && !secondaryMuscleGroups.isEmpty()) {
			this.secondaryMuscleGroups = EnumSet.copyOf(secondaryMuscleGroups);
		}
	}

	public UUID getOwnerId() {
		return ownerId;
	}

	public UUID getId() {
		return id;
	}

	public String getSlug() {
		return slug;
	}

	public String getName() {
		return name;
	}

	public MuscleGroup getPrimaryMuscleGroup() {
		return primaryMuscleGroup;
	}

	public Set<MuscleGroup> getSecondaryMuscleGroups() {
		return secondaryMuscleGroups;
	}

}
