import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WorkoutSet } from '../api/client'

interface SessionSetListProps {
  sets: WorkoutSet[]
  exerciseNames: Map<string, string>
  onDelete: (setId: string) => Promise<void>
}

export default function SessionSetList({ sets, exerciseNames, onDelete }: SessionSetListProps) {
  const { t } = useTranslation()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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
            <span className="set-item-name">{exerciseNames.get(set.exerciseId) ?? t('common.unknownExercise')}</span>
            <span>
              {set.reps} × {set.weightKg} kg
              {set.personalRecord && (
                <span className="pr-badge" role="img" aria-label={t('common.personalRecord')}>
                  PR
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
