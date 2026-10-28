import { useTranslation } from 'react-i18next'
import type { Exercise } from '../api/client'
import { exerciseName, sortExercisesByName } from '../utils/exercises'

interface ExercisePickerProps {
  exercises: Exercise[]
  selectedId: string
  onChange: (exerciseId: string) => void
}

export default function ExercisePicker({ exercises, selectedId, onChange }: ExercisePickerProps) {
  const { t } = useTranslation()
  return (
    <div className="field">
      <label htmlFor="exercise-select">{t('exercises.picker.label')}</label>
      <select
        id="exercise-select"
        className="workout-select"
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          {t('exercises.picker.choose')}
        </option>
        {sortExercisesByName(exercises).map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exerciseName(exercise)}
          </option>
        ))}
      </select>
    </div>
  )
}
