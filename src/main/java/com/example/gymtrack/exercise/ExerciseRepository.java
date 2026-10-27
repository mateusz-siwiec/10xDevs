package com.example.gymtrack.exercise;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {

	List<Exercise> findAllByOrderByNameAsc();

	List<Exercise> findByPrimaryMuscleGroupOrderByNameAsc(MuscleGroup primaryMuscleGroup);

	List<Exercise> findByPrimaryMuscleGroupAndIdNotOrderByNameAsc(MuscleGroup primaryMuscleGroup, UUID id);

	@Query("select e from Exercise e where e.ownerId is null or e.ownerId = :userId order by e.name asc")
	List<Exercise> findVisibleOrderByName(@Param("userId") UUID userId);

	@Query("""
			select e from Exercise e
			where (e.ownerId is null or e.ownerId = :userId) and e.primaryMuscleGroup = :muscleGroup
			order by e.name asc
			""")
	List<Exercise> findVisibleByPrimaryMuscleGroupOrderByName(@Param("userId") UUID userId,
			@Param("muscleGroup") MuscleGroup muscleGroup);

	@Query("select e from Exercise e where e.id = :id and (e.ownerId is null or e.ownerId = :userId)")
	Optional<Exercise> findVisibleById(@Param("id") UUID id, @Param("userId") UUID userId);

	@Query("select count(e) > 0 from Exercise e where e.id = :id and (e.ownerId is null or e.ownerId = :userId)")
	boolean existsVisible(@Param("id") UUID id, @Param("userId") UUID userId);

	@Query("""
			select count(e) > 0 from Exercise e
			where lower(e.name) = lower(:name) and (e.ownerId is null or e.ownerId = :userId)
			""")
	boolean existsVisibleByName(@Param("name") String name, @Param("userId") UUID userId);

	List<Exercise> findByOwnerIdOrderByNameAsc(UUID ownerId);

	Optional<Exercise> findByIdAndOwnerId(UUID id, UUID ownerId);

}
