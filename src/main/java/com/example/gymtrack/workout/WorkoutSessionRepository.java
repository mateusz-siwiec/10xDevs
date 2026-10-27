package com.example.gymtrack.workout;

import java.time.Instant;
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
			order by s.endedAt desc, s.startedAt desc, s.id desc
			""")
	List<WorkoutSession> findRecentEndedWithExercise(@Param("userId") UUID userId,
			@Param("exerciseId") UUID exerciseId, Pageable pageable);

	@Query("""
			select s from WorkoutSession s
			where s.userId = :userId and s.planId = :planId and s.endedAt is not null
			and exists (select 1 from WorkoutSet w where w.session = s and w.exerciseId = :exerciseId)
			order by s.endedAt desc, s.startedAt desc, s.id desc
			""")
	List<WorkoutSession> findRecentEndedInPlanWithExercise(@Param("userId") UUID userId,
			@Param("planId") UUID planId, @Param("exerciseId") UUID exerciseId, Pageable pageable);

	@Query("""
			select s from WorkoutSession s
			where s.userId = :userId and s.endedAt >= :since
			""")
	List<WorkoutSession> findEndedSince(@Param("userId") UUID userId, @Param("since") Instant since);

}
