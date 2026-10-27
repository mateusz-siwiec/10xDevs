package com.example.gymtrack.exercise;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {

	List<Exercise> findAllByOrderByNameAsc();

	List<Exercise> findByPrimaryMuscleGroupOrderByNameAsc(MuscleGroup primaryMuscleGroup);

	List<Exercise> findByPrimaryMuscleGroupAndIdNotOrderByNameAsc(MuscleGroup primaryMuscleGroup, UUID id);

}
