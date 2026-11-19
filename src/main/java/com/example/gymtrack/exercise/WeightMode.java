package com.example.gymtrack.exercise;

/**
 * Whether sets of an exercise carry an external load: {@code REQUIRED} (weight must be above zero),
 * {@code OPTIONAL} (zero means bodyweight) or {@code NONE} (the exercise never uses weight).
 */
public enum WeightMode {

	REQUIRED, OPTIONAL, NONE

}
