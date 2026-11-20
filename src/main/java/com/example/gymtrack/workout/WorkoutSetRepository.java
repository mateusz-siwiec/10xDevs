package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutSetRepository extends JpaRepository<WorkoutSet, UUID> {

	boolean existsByExerciseId(UUID exerciseId);

	List<WorkoutSet> findBySessionIdOrderByLoggedAtAscIdAsc(UUID sessionId);

	Optional<WorkoutSet> findByIdAndSessionId(UUID id, UUID sessionId);

	@Query("""
			select new com.example.gymtrack.workout.ProgressionRow(s.session.id, s.session.startedAt, max(s.weightKg), max(s.reps), max(s.durationSeconds))
			from WorkoutSet s
			where s.exerciseId = :exerciseId and s.session.userId = :userId
			group by s.session.id, s.session.startedAt
			order by s.session.startedAt asc
			""")
	List<ProgressionRow> findProgression(@Param("userId") UUID userId,
			@Param("exerciseId") UUID exerciseId);

	@Query("""
			select coalesce(sum(s.reps * s.weightKg), 0)
			from WorkoutSet s
			where s.session.userId = :userId and s.session.endedAt >= :from
			and s.session.endedAt < :to and s.reps is not null
			""")
	BigDecimal sumVolumeBetween(@Param("userId") UUID userId, @Param("from") Instant from,
			@Param("to") Instant to);

	@Query("""
			select new com.example.gymtrack.workout.ExerciseSetCount(e.id, count(s),
				sum(case when s.toFailure = true then 1L else 0L end))
			from WorkoutSet s, Exercise e
			where e.id = s.exerciseId and s.session.userId = :userId
			and s.session.endedAt >= :from and s.session.endedAt < :to
			group by e.id
			""")
	List<ExerciseSetCount> countSetsByExerciseBetween(@Param("userId") UUID userId, @Param("from") Instant from,
			@Param("to") Instant to);

	@Query("""
			select new com.example.gymtrack.workout.SessionAggregate(s.session.id, count(s), coalesce(sum(s.reps * s.weightKg), 0))
			from WorkoutSet s
			where s.session.id in :sessionIds
			group by s.session.id
			""")
	List<SessionAggregate> aggregateBySession(@Param("sessionIds") Collection<UUID> sessionIds);

	/**
	 * One row per exercise and rep count with the heaviest weight's score. For a fixed rep count a heavier set always
	 * scores higher, so the best (score, reps) pair over these rows is the best over all earlier sets, while the row
	 * count stays bounded by the distinct rep counts instead of growing with the history.
	 */
	@Query("""
			select new com.example.gymtrack.workout.ExerciseScore(s.exerciseId, max(s.weightKg) * (30 + s.reps), s.reps)
			from WorkoutSet s
			where s.session.userId = :userId and s.exerciseId in :exerciseIds
				and s.reps is not null and (s.reps <= :maxReps or s.weightKg = 0) and s.loggedAt < :before
			group by s.exerciseId, s.reps
			""")
	List<ExerciseScore> findBestScoresBefore(@Param("userId") UUID userId,
			@Param("exerciseIds") Collection<UUID> exerciseIds, @Param("maxReps") int maxReps,
			@Param("before") Instant before);

	/** One row per exercise and duration with the heaviest weight, so the row count is bounded by distinct durations. */
	@Query("""
			select new com.example.gymtrack.workout.DurationScore(s.exerciseId, s.durationSeconds, max(s.weightKg))
			from WorkoutSet s
			where s.session.userId = :userId and s.exerciseId in :exerciseIds
				and s.durationSeconds is not null and s.loggedAt < :before
			group by s.exerciseId, s.durationSeconds
			""")
	List<DurationScore> findBestDurationScoresBefore(@Param("userId") UUID userId,
			@Param("exerciseIds") Collection<UUID> exerciseIds, @Param("before") Instant before);

	@Query("""
			select s from WorkoutSet s join fetch s.session ss
			where ss.userId = :userId and ss.endedAt is not null
				and (s.reps is null or s.reps <= :maxReps or s.weightKg = 0)
			order by s.loggedAt asc, s.id asc
			""")
	List<WorkoutSet> findEligibleSetsOfEndedSessions(@Param("userId") UUID userId, @Param("maxReps") int maxReps);

}
