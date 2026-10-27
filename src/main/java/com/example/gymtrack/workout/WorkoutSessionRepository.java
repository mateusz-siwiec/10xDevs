package com.example.gymtrack.workout;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutSessionRepository extends JpaRepository<WorkoutSession, UUID> {

	Optional<WorkoutSession> findByUserIdAndEndedAtIsNull(UUID userId);

	Optional<WorkoutSession> findByIdAndUserId(UUID id, UUID userId);

	@Query("""
			select s from WorkoutSession s
			where s.userId = :userId and s.endedAt is not null
			and exists (select 1 from WorkoutSet w where w.session = s and w.exerciseId = :exerciseId)
			order by s.endedAt desc, s.startedAt desc
			""")
	List<WorkoutSession> findRecentEndedWithExercise(@Param("userId") UUID userId,
			@Param("exerciseId") UUID exerciseId, Pageable pageable);

}
