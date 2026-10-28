import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, getExercises, getHistorySession } from '../api/client'
import type { Exercise, HistoryDetail } from '../api/client'
import { formatDate, formatDuration, formatVolume } from '../utils/format'
import '../styles/page.css'
import '../styles/history.css'

interface FetchResult {
  id: string
  data: HistoryDetail | null
  exercises: Exercise[]
  notFound: boolean
  error: string | null
}

export default function HistoryDetailPage() {
  const { id = '' } = useParams()
  const [result, setResult] = useState<FetchResult | null>(null)

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
          error: err instanceof Error ? err.message : 'Failed to load workout',
        })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const shown = result !== null && result.id === id ? result : null
  const backLink = (
    <Link to="/history" className="history-back">
      Back to history
    </Link>
  )

  let body
  if (shown === null) {
    body = <p className="page-subtext">Loading workout…</p>
  } else if (shown.notFound) {
    body = (
      <>
        <p className="page-subtext">Workout not found</p>
        {backLink}
      </>
    )
  } else if (shown.error || shown.data === null) {
    body = (
      <>
        <p className="error-text" role="alert">
          {shown.error ?? 'Failed to load workout'}
        </p>
        {backLink}
      </>
    )
  } else {
    const { data, exercises } = shown
    const names = new Map(exercises.map((e) => [e.id, e.name]))
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
          <p className="page-subtext">No sets were logged in this workout.</p>
        ) : (
          groups.map((group, gi) => (
            <section key={`${group.exerciseId}-${gi}`} className="history-detail-exercise">
              <h2>{names.get(group.exerciseId) ?? 'Unknown exercise'}</h2>
              <ol>
                {group.sets.map((set, index) => (
                  <li key={index}>
                    Set {index + 1}: {set.reps} × {set.weightKg} kg
                    {set.personalRecord && (
                      <span className="pr-badge" role="img" aria-label="New personal record">
                        PR
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
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
