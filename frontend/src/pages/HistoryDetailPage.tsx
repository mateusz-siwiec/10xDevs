import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, deleteWorkout, getExercises, getHistorySession } from '../api/client'
import type { Exercise, HistoryDetail } from '../api/client'
import { exerciseName } from '../utils/exercises'
import { formatDate, formatDuration, formatVolume } from '../utils/format'
import '../styles/page.css'
import '../styles/history.css'
import { translateError } from '../utils/errors'

interface FetchResult {
  id: string
  data: HistoryDetail | null
  exercises: Exercise[]
  notFound: boolean
  error: unknown
}

export default function HistoryDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<FetchResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<unknown>(null)

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteWorkout(id)
      navigate('/history')
    } catch (err) {
      setDeleteError(err)
      setDeleting(false)
      setConfirming(false)
    }
  }

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    Promise.all([getHistorySession(id), getExercises()])
      .then(([data, exercises]) => {
        if (!cancelled) setResult({ id, data, exercises, notFound: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        const notFound = err instanceof ApiError && err.status === 404
        setResult({
          id,
          data: null,
          exercises: [],
          notFound,
          error: err,
        })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const shown = result !== null && result.id === id ? result : null
  const backLink = (
    <Link to="/history" className="history-back">
      {t('history.detail.back')}
    </Link>
  )

  let body
  if (shown === null) {
    body = <p className="page-subtext">{t('history.detail.loading')}</p>
  } else if (shown.notFound) {
    body = (
      <>
        <p className="page-subtext">{t('history.detail.notFound')}</p>
        {backLink}
      </>
    )
  } else if (shown.error || shown.data === null) {
    body = (
      <>
        <p className="error-text" role="alert">
          {translateError(shown.error, 'history.detail.loadFailed')}
        </p>
        {backLink}
      </>
    )
  } else {
    const { data, exercises } = shown
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const nameOf = (exerciseId: string) => {
      const exercise = byId.get(exerciseId)
      return exercise ? exerciseName(exercise) : t('common.unknownExercise')
    }
    const groups = data.exercises.filter((g) => g.sets.length > 0)
    body = (
      <>
        {backLink}
        <h1>
          {formatDate(data.startedAt)}
          {data.planName && ` · ${data.planName}`}
        </h1>
        <p className="history-detail-meta">
          <span>{formatDuration(data.durationSeconds)}</span>
          <span>{formatVolume(data.volumeKg)}</span>
        </p>
        {groups.length === 0 ? (
          <p className="page-subtext">{t('history.detail.noSets')}</p>
        ) : (
          groups.map((group, gi) => (
            <section key={`${group.exerciseId}-${gi}`} className="history-detail-exercise">
              <h2>{nameOf(group.exerciseId)}</h2>
              <ol>
                {group.sets.map((set, index) => (
                  <li key={index}>
                    {t('history.detail.setLine', { n: index + 1, reps: set.reps, weight: set.weightKg })}
                    {set.personalRecord && (
                      <span className="pr-badge" role="img" aria-label={t('common.personalRecord')}>
                        PR
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
        {deleteError !== null && (
          <p className="error-text" role="alert">
            {translateError(deleteError, 'history.detail.deleteFailed')}
          </p>
        )}
        <div className="history-detail-actions">
          {confirming ? (
            <>
              <span>{t('history.detail.deleteConfirm')}</span>
              <button type="button" className="btn-danger" disabled={deleting} onClick={handleDelete}>
                {t('common.confirm')}
              </button>
              <button type="button" className="btn-secondary" disabled={deleting} onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setConfirming(true)}>
              {t('history.detail.delete')}
            </button>
          )}
        </div>
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card history-card">
        <div aria-live="polite">{body}</div>
      </main>
    </div>
  )
}
