package com.example.gymtrack.plan;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrainingPlanRepository extends JpaRepository<TrainingPlan, UUID> {

	List<TrainingPlan> findByUserIdOrderByUpdatedAtDesc(UUID userId);

	Optional<TrainingPlan> findByIdAndUserId(UUID id, UUID userId);

}
