package com.example.gymtrack.exercise;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * A user's starred exercise. Per user, so it works for shared catalog exercises as well as custom ones.
 */
@Entity
@Table(name = "favorite_exercises")
public class FavoriteExercise {

	@EmbeddedId
	private Key id;

	protected FavoriteExercise() {
	}

	public FavoriteExercise(UUID userId, UUID exerciseId) {
		this.id = new Key(userId, exerciseId);
	}

	@Embeddable
	public static class Key implements Serializable {

		@Column(name = "user_id", nullable = false)
		private UUID userId;

		@Column(name = "exercise_id", nullable = false)
		private UUID exerciseId;

		protected Key() {
		}

		Key(UUID userId, UUID exerciseId) {
			this.userId = userId;
			this.exerciseId = exerciseId;
		}

		@Override
		public boolean equals(Object o) {
			return o instanceof Key other && Objects.equals(userId, other.userId)
					&& Objects.equals(exerciseId, other.exerciseId);
		}

		@Override
		public int hashCode() {
			return Objects.hash(userId, exerciseId);
		}

	}

}
