import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Exercise } from '../api/client'
import { exerciseName, matchesExerciseSearch, sortExercisesByName } from '../utils/exercises'
import { muscleGroupLabel } from '../utils/muscleGroups'

interface ExercisePickerProps {
  exercises: Exercise[]
  selectedId: string
  onChange: (exerciseId: string) => void
}

function ExerciseOption({ exercise }: { exercise: Exercise }) {
  return (
    <option value={exercise.id}>
      {exerciseName(exercise)} — {muscleGroupLabel(exercise.primaryMuscleGroup)}
    </option>
  )
}

export default function ExercisePicker({ exercises, selectedId, onChange }: ExercisePickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const matches = exercises.filter((exercise) => matchesExerciseSearch(exercise, query))
  // The selected exercise stays listed even when it does not match, so the controlled select keeps its value.
  const visible = sortExercisesByName(
    exercises.filter((exercise) => exercise.id === selectedId || matches.includes(exercise)),
  )
  const hasFavorites = exercises.some((exercise) => exercise.favorite)
  const favorites = visible.filter((exercise) => exercise.favorite)
  const others = visible.filter((exercise) => !exercise.favorite)

  return (
    <div className="exercise-picker">
      <div className="field">
        <label htmlFor="exercise-search">{t('exercises.picker.filterLabel')}</label>
        <input
          id="exercise-search"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
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
          {hasFavorites ? (
            <>
              {favorites.length > 0 && (
                <optgroup label={t('exercises.picker.favorites')}>
                  {favorites.map((exercise) => (
                    <ExerciseOption key={exercise.id} exercise={exercise} />
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label={t('exercises.picker.others')}>
                  {others.map((exercise) => (
                    <ExerciseOption key={exercise.id} exercise={exercise} />
                  ))}
                </optgroup>
              )}
            </>
          ) : (
            visible.map((exercise) => <ExerciseOption key={exercise.id} exercise={exercise} />)
          )}
        </select>
        <p className="page-subtext exercise-picker-hint" aria-live="polite">
          {matches.length === 0 ? t('exercises.picker.noMatches') : ''}
        </p>
      </div>
    </div>
  )
}
