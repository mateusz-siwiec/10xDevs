import type { Exercise } from '../api/client'

interface ExercisePickerProps {
  exercises: Exercise[]
  selectedId: string
  onChange: (exerciseId: string) => void
}

export default function ExercisePicker({ exercises, selectedId, onChange }: ExercisePickerProps) {
  return (
    <div className="field">
      <label htmlFor="exercise-select">Exercise</label>
      <select
        id="exercise-select"
        className="workout-select"
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Choose an exercise…
        </option>
        {exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>
    </div>
  )
}
