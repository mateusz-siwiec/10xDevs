package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * FR-014 rule: a set is a personal record when its estimated one-rep max beats every earlier
 * eligible set the user logged for that exercise. The Epley estimate {@code weight * (1 + reps/30)}
 * is compared as the exact score {@code weight * (30 + reps)} (Epley x 30), and only a strictly
 * greater score counts, so ties are not records. The first eligible set of an exercise has nothing
 * to beat and is not flagged. Sets above {@link #MAX_ELIGIBLE_REPS} reps are ignored entirely:
 * never flagged and never part of the baseline, because 1RM estimates are least reliable at higher
 * reps. The flag is derived on every read, so deleting a set re-judges the ones after it.
 * <p>
 * Not a transaction boundary: call it inside the caller's transaction.
 */
@Service
public class PersonalRecordService {

	static final int MAX_ELIGIBLE_REPS = 12;

	private static final BigDecimal EPLEY_BASE = BigDecimal.valueOf(30);

	private final WorkoutSetRepository setRepository;

	public PersonalRecordService(WorkoutSetRepository setRepository) {
		this.setRepository = setRepository;
	}

	/** Ids of the flagged sets; {@code sets} are the session's sets in {@code loggedAt} order. */
	public Set<UUID> personalRecordSetIds(WorkoutSession session, List<WorkoutSet> sets) {
		Set<UUID> exerciseIds = sets.stream()
			.filter(PersonalRecordService::isEligible)
			.map(WorkoutSet::getExerciseId)
			.collect(Collectors.toSet());
		if (exerciseIds.isEmpty()) {
			return Set.of();
		}
		Map<UUID, BigDecimal> best = new HashMap<>();
		for (ExerciseScore baseline : setRepository.findBestScoresBefore(session.getUserId(), exerciseIds,
				MAX_ELIGIBLE_REPS, session.getStartedAt())) {
			best.put(baseline.exerciseId(), baseline.score());
		}
		Set<UUID> flagged = new HashSet<>();
		for (WorkoutSet set : sets) {
			if (!isEligible(set)) {
				continue;
			}
			BigDecimal score = score(set);
			BigDecimal previousBest = best.get(set.getExerciseId());
			if (previousBest == null) {
				best.put(set.getExerciseId(), score);
			}
			else if (score.compareTo(previousBest) > 0) {
				flagged.add(set.getId());
				best.put(set.getExerciseId(), score);
			}
		}
		return flagged;
	}

	private static boolean isEligible(WorkoutSet set) {
		return set.getReps() <= MAX_ELIGIBLE_REPS;
	}

	private static BigDecimal score(WorkoutSet set) {
		return set.getWeightKg().multiply(EPLEY_BASE.add(BigDecimal.valueOf(set.getReps())));
	}

}
