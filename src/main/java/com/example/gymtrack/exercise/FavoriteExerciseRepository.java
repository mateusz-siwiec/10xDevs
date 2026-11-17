package com.example.gymtrack.exercise;

import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FavoriteExerciseRepository extends JpaRepository<FavoriteExercise, FavoriteExercise.Key> {

	@Query("select f.id.exerciseId from FavoriteExercise f where f.id.userId = :userId")
	Set<UUID> findExerciseIdsByUserId(@Param("userId") UUID userId);

	/** Idempotent insert: a repeated favourite (or a concurrent one) is a no-op, not a constraint error. */
	@Modifying
	@Query(value = """
			insert into favorite_exercises (user_id, exercise_id) values (:userId, :exerciseId)
			on conflict do nothing
			""", nativeQuery = true)
	void addIfAbsent(@Param("userId") UUID userId, @Param("exerciseId") UUID exerciseId);

	@Modifying
	@Query("delete from FavoriteExercise f where f.id.userId = :userId and f.id.exerciseId = :exerciseId")
	void remove(@Param("userId") UUID userId, @Param("exerciseId") UUID exerciseId);

}
