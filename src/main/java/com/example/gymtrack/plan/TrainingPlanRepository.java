package com.example.gymtrack.plan;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TrainingPlanRepository extends JpaRepository<TrainingPlan, UUID> {

	List<TrainingPlan> findByUserIdOrderByUpdatedAtDesc(UUID userId);

	Optional<TrainingPlan> findByIdAndUserId(UUID id, UUID userId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select p from TrainingPlan p where p.id = :id and p.userId = :userId")
	Optional<TrainingPlan> findByIdAndUserIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

	@Query("select count(e) > 0 from TrainingPlanEntry e where e.exerciseId = :exerciseId")
	boolean existsEntryByExerciseId(@Param("exerciseId") UUID exerciseId);

}
