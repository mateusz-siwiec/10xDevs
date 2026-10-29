import { useTranslation } from 'react-i18next'
import { exerciseName } from '../utils/exercises'

export interface PlanEditorEntry {
  key: string
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
  sets: string
  reps: string
}

export type PlanTargetField = 'sets' | 'reps'

interface PlanExerciseListProps {
  entries: PlanEditorEntry[]
  disabled: boolean
  onMove: (index: number, delta: -1 | 1) => void
  onRemove: (key: string) => void
  onTargetChange: (key: string, field: PlanTargetField, value: string) => void
}

export default function PlanExerciseList({
  entries,
  disabled,
  onMove,
  onRemove,
  onTargetChange,
}: PlanExerciseListProps) {
  const { t } = useTranslation()
  if (entries.length === 0) {
    return <p className="page-subtext">{t('plans.editor.noExercises')}</p>
  }

  return (
    <ol className="plan-exercise-list">
      {entries.map((entry, index) => (
        <li key={entry.key} className="plan-exercise-item">
          <span className="plan-exercise-name">{exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName })}</span>
          <div className="plan-exercise-targets">
            <label className="plan-target-field">
              <span>{t('plans.editor.sets')}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('plans.editor.setsFor', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
                value={entry.sets}
                disabled={disabled}
                onChange={(event) => onTargetChange(entry.key, 'sets', event.target.value)}
              />
            </label>
            <label className="plan-target-field">
              <span>{t('plans.editor.reps')}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('plans.editor.repsFor', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
                value={entry.reps}
                disabled={disabled}
                onChange={(event) => onTargetChange(entry.key, 'reps', event.target.value)}
              />
            </label>
          </div>
          <div className="plan-exercise-actions">
            <button
              type="button"
              className="btn-secondary"
              aria-label={t('plans.editor.moveUpLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled || index === 0}
              onClick={() => onMove(index, -1)}
            >
              {t('plans.editor.moveUp')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={t('plans.editor.moveDownLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled || index === entries.length - 1}
              onClick={() => onMove(index, 1)}
            >
              {t('plans.editor.moveDown')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={t('plans.editor.removeLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled}
              onClick={() => onRemove(entry.key)}
            >
              {t('plans.editor.remove')}
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
