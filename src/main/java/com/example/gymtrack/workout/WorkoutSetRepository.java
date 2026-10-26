package com.example.gymtrack.workout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutSetRepository extends JpaRepository<WorkoutSet, UUID> {

	List<WorkoutSet> findBySessionIdOrderByLoggedAtAsc(UUID sessionId);

	Optional<WorkoutSet> findByIdAndSessionId(UUID id, UUID sessionId);

}
