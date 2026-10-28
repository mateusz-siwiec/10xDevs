package com.example.gymtrack.workout;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
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

	static final int MAX_ELIGIBLE_REPS = 15;

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

	/**
	 * The user's latest record sets across all ended sessions, newest first. Scans the eligible sets
	 * in {@code loggedAt} order with a running best per exercise, applying the same eligibility and
	 * score rule as {@link #personalRecordSetIds}, so it agrees with the flags History shows. The
	 * agreement relies on sessions never overlapping in time: set and session timestamps are only ever
	 * assigned at creation and a user has one active session at a time, so a running best by
	 * {@code loggedAt} equals History's "everything logged before the session started" baseline.
	 */
	public List<PersonalRecordEntry> recentRecords(UUID userId, int limit) {
		Map<UUID, BigDecimal> best = new HashMap<>();
		List<PersonalRecordEntry> records = new ArrayList<>();
		for (WorkoutSet set : setRepository.findEligibleSetsOfEndedSessions(userId, MAX_ELIGIBLE_REPS)) {
			if (!isEligible(set)) {
				continue;
			}
			BigDecimal score = score(set);
			BigDecimal previousBest = best.get(set.getExerciseId());
			if (previousBest == null) {
				best.put(set.getExerciseId(), score);
			}
			else if (score.compareTo(previousBest) > 0) {
				records.add(new PersonalRecordEntry(set.getSession().getId(), set.getExerciseId(), set.getReps(),
						set.getWeightKg(), set.getLoggedAt()));
				best.put(set.getExerciseId(), score);
			}
		}
		Collections.reverse(records);
		return records.size() > limit ? List.copyOf(records.subList(0, limit)) : records;
	}

	private static boolean isEligible(WorkoutSet set) {
		return set.getReps() <= MAX_ELIGIBLE_REPS;
	}

	private static BigDecimal score(WorkoutSet set) {
		return set.getWeightKg().multiply(EPLEY_BASE.add(BigDecimal.valueOf(set.getReps())));
	}

}
