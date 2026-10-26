package com.example.gymtrack.workout;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SessionResponse(UUID id, Instant startedAt, Instant endedAt, UUID planId,
		List<SetResponse> sets) {

	static SessionResponse from(WorkoutSession session, List<WorkoutSet> sets) {
		return new SessionResponse(session.getId(), session.getStartedAt(), session.getEndedAt(),
				session.getPlanId(), sets.stream().map(SetResponse::from).toList());
	}

}
