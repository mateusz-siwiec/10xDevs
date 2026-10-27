package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutSetRepository extends JpaRepository<WorkoutSet, UUID> {

	List<WorkoutSet> findBySessionIdOrderByLoggedAtAsc(UUID sessionId);

	Optional<WorkoutSet> findByIdAndSessionId(UUID id, UUID sessionId);

	@Query("""
			select new com.example.gymtrack.workout.ProgressionPointResponse(s.session.id, s.session.startedAt, max(s.weightKg))
			from WorkoutSet s
			where s.exerciseId = :exerciseId and s.session.userId = :userId
			group by s.session.id, s.session.startedAt
			order by s.session.startedAt asc
			""")
	List<ProgressionPointResponse> findProgression(@Param("userId") UUID userId,
			@Param("exerciseId") UUID exerciseId);

	@Query("""
			select coalesce(sum(s.reps * s.weightKg), 0)
			from WorkoutSet s
			where s.session.userId = :userId and s.session.endedAt >= :since
			""")
	BigDecimal sumVolumeSince(@Param("userId") UUID userId, @Param("since") Instant since);

}
