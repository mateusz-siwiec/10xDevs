package com.example.gymtrack.exercise;

public enum MuscleGroup {
	UPPER_CHEST(MuscleParent.CHEST),
	MID_CHEST(MuscleParent.CHEST),
	LOWER_CHEST(MuscleParent.CHEST),
	LATS(MuscleParent.BACK),
	TRAPS(MuscleParent.BACK),
	LOWER_BACK(MuscleParent.BACK),
	FRONT_DELTS(MuscleParent.SHOULDERS),
	SIDE_DELTS(MuscleParent.SHOULDERS),
	REAR_DELTS(MuscleParent.SHOULDERS),
	BICEPS(MuscleParent.ARMS),
	TRICEPS(MuscleParent.ARMS),
	FOREARMS(MuscleParent.ARMS),
	QUADS(MuscleParent.LEGS),
	HAMSTRINGS(MuscleParent.LEGS),
	GLUTES(MuscleParent.LEGS),
	ADDUCTORS(MuscleParent.LEGS),
	ABDUCTORS(MuscleParent.LEGS),
	CALVES(MuscleParent.LEGS),
	ABS(MuscleParent.CORE),
	OBLIQUES(MuscleParent.CORE);

	private final MuscleParent parent;

	MuscleGroup(MuscleParent parent) {
		this.parent = parent;
	}

	/** The stats parent row this group belongs to; mirrors {@code MUSCLE_PARENTS} in the frontend. */
	public MuscleParent parent() {
		return parent;
	}
}
