import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSubstitutes } from '../api/client'
import type { Exercise } from '../api/client'
import { translateError } from '../utils/errors'

interface SubstituteSuggestionsProps {
  exerciseId: string
  onAccept: (exerciseId: string) => void
  onDismiss: () => void
}

interface FetchResult {
  key: string
  items: Exercise[]
  error: string | null
}

const MAX_SUGGESTIONS = 3

export default function SubstituteSuggestions({
  exerciseId,
  onAccept,
  onDismiss,
}: SubstituteSuggestionsProps) {
  const { t } = useTranslation()
  const [result, setResult] = useState<FetchResult | null>(null)

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    getSubstitutes(exerciseId)
      .then((items) => {
        if (!cancelled) setResult({ key: exerciseId, items, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key: exerciseId,
            items: [],
            error: translateError(err) ?? '',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  const current = result !== null && result.key === exerciseId ? result : null

  let body
  if (current === null) {
    body = <p className="page-subtext">{t('workout.substitutes.loading')}</p>
  } else if (current.error !== null) {
    body = (
      <p className="error-text" role="alert">
        {current.error || t('workout.substitutes.loadFailed')}
      </p>
    )
  } else if (current.items.length === 0) {
    body = <p className="page-subtext">{t('workout.substitutes.empty')}</p>
  } else {
    body = (
      <ul className="substitute-list">
        {current.items.slice(0, MAX_SUGGESTIONS).map((exercise) => (
          <li key={exercise.id} className="substitute-item">
            <div className="substitute-item-info">
              <span className="substitute-item-name">{exercise.name}</span>
              <span className="page-subtext">{exercise.primaryMuscleGroup}</span>
            </div>
            <button
              type="button"
              className="btn-primary"
              aria-label={t('workout.substitutes.useLabel', { name: exercise.name })}
              onClick={() => onAccept(exercise.id)}
            >
              {t('workout.substitutes.useThis')}
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <section className="workout-section substitute-panel" aria-labelledby="substitute-heading">
      <div className="substitute-header">
        <h2 id="substitute-heading">{t('workout.substitutes.title')}</h2>
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          {t('workout.substitutes.dismiss')}
        </button>
      </div>
      <div aria-live="polite">{body}</div>
    </section>
  )
}
