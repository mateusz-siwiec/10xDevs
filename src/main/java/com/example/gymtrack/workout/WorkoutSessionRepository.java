package com.example.gymtrack.workout;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutSessionRepository extends JpaRepository<WorkoutSession, UUID> {

	Optional<WorkoutSession> findByUserIdAndEndedAtIsNull(UUID userId);

	Optional<WorkoutSession> findByIdAndUserId(UUID id, UUID userId);

}
