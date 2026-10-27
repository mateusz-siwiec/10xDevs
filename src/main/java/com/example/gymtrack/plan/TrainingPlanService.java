package com.example.gymtrack.plan;

import com.example.gymtrack.common.ResourceNotFoundException;
import com.example.gymtrack.exercise.Exercise;
import com.example.gymtrack.exercise.ExerciseRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TrainingPlanService {

	private final TrainingPlanRepository planRepository;

	private final ExerciseRepository exerciseRepository;

	public TrainingPlanService(TrainingPlanRepository planRepository, ExerciseRepository exerciseRepository) {
		this.planRepository = planRepository;
		this.exerciseRepository = exerciseRepository;
	}

	@Transactional(readOnly = true)
	public List<PlanSummaryResponse> list(UUID userId) {
		return planRepository.findByUserIdOrderByUpdatedAtDesc(userId).stream().map(PlanSummaryResponse::from).toList();
	}

	@Transactional(readOnly = true)
	public PlanResponse get(UUID userId, UUID planId) {
		TrainingPlan plan = findOwned(userId, planId);
		List<UUID> exerciseIds = plan.getEntries().stream().map(TrainingPlanEntry::getExerciseId).toList();
		return PlanResponse.from(plan, loadExerciseNames(userId, exerciseIds));
	}

	@Transactional
	public PlanResponse create(UUID userId, String name, List<PlanEntryInput> entries) {
		Map<UUID, String> names = loadExerciseNames(userId, exerciseIds(entries));
		TrainingPlan plan = new TrainingPlan(userId, name.trim());
		plan.replaceEntries(entries);
		planRepository.saveAndFlush(plan);
		return PlanResponse.from(plan, names);
	}

	@Transactional
	public PlanResponse replace(UUID userId, UUID planId, String name, List<PlanEntryInput> entries) {
		// Row lock serializes concurrent replaces of the same plan; otherwise the unique position index can 500.
		TrainingPlan plan = planRepository.findByIdAndUserIdForUpdate(planId, userId)
			.orElseThrow(() -> new PlanNotFoundException("Training plan not found"));
		Map<UUID, String> names = loadExerciseNames(userId, exerciseIds(entries));
		plan.rename(name.trim());
		// (plan_id, position) is unique and inserts flush before deletes: remove old entries first.
		plan.replaceEntries(List.of());
		planRepository.flush();
		plan.replaceEntries(entries);
		planRepository.saveAndFlush(plan);
		return PlanResponse.from(plan, names);
	}

	@Transactional
	public void delete(UUID userId, UUID planId) {
		planRepository.delete(findOwned(userId, planId));
	}

	private TrainingPlan findOwned(UUID userId, UUID planId) {
		return planRepository.findByIdAndUserId(planId, userId)
			.orElseThrow(() -> new PlanNotFoundException("Training plan not found"));
	}

	private static List<UUID> exerciseIds(List<PlanEntryInput> entries) {
		return entries.stream().map(PlanEntryInput::exerciseId).toList();
	}

	private Map<UUID, String> loadExerciseNames(UUID userId, List<UUID> exerciseIds) {
		List<UUID> distinct = exerciseIds.stream().distinct().toList();
		Map<UUID, String> names = new HashMap<>();
		for (Exercise exercise : exerciseRepository.findVisibleByIdIn(distinct, userId)) {
			names.put(exercise.getId(), exercise.getName());
		}
		if (names.size() != distinct.size()) {
			throw new ResourceNotFoundException("Exercise not found");
		}
		return names;
	}

}
