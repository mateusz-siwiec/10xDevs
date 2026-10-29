import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkoutSet } from '../api/client'
import { exerciseName } from '../utils/exercises'
import type { NamedExercise } from '../utils/exercises'

interface SessionSetListProps {
  sets: WorkoutSet[]
  exercisesById: Map<string, NamedExercise>
  onDelete: (setId: string) => Promise<void>
}

export default function SessionSetList({ sets, exercisesById, onDelete }: SessionSetListProps) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const nameOf = (exerciseId: string) => {
    const exercise = exercisesById.get(exerciseId)
    return exercise ? exerciseName(exercise) : t('common.unknownExercise')
  }

  if (sets.length === 0) {
    return <p className="page-subtext">{t('workout.noSets')}</p>
  }

  async function confirmDelete(setId: string) {
    try {
      await onDelete(setId)
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <ul className="set-list">
      {sets.map((set) => (
        <li key={set.id} className="set-item">
          <div className="set-item-info">
            <span className="set-item-name">{nameOf(set.exerciseId)}</span>
            <span>
              {set.reps} × {set.weightKg} kg
              {set.personalRecord && (
                <span className="pr-badge" role="img" aria-label={t('common.personalRecord')}>
                  {t('common.prBadge')}
                </span>
              )}
            </span>
          </div>
          {confirmingId === set.id ? (
            <div className="set-item-actions">
              <button type="button" className="btn-danger" onClick={() => confirmDelete(set.id)}>
                {t('common.confirm')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setConfirmingId(null)}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setConfirmingId(set.id)}>
              {t('common.delete')}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
