import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getMuscleGroupStats } from '../api/client'
import type { MuscleGroupStats, StatsWindow } from '../api/client'
import { muscleGroupLabel } from '../utils/muscleGroups'
import '../styles/page.css'
import '../styles/dashboard.css'
import { translateError } from '../utils/errors'

interface FetchResult {
  days: StatsWindow
  stats: MuscleGroupStats | null
  error: unknown
}

const WINDOW_OPTIONS: { value: StatsWindow; label: string | null }[] = [
  { value: 7, label: '7' },
  { value: 30, label: '30' },
  { value: 90, label: '90' },
  { value: 'all', label: null },
]

export default function MuscleGroupStatsPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<StatsWindow>(30)
  const [result, setResult] = useState<FetchResult | null>(null)

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    getMuscleGroupStats(days)
      .then((stats) => {
        if (!cancelled) setResult({ days, stats, error: null })
      })
      .catch((err) => {
        if (!cancelled) setResult({ days, stats: null, error: err })
      })
    return () => {
      cancelled = true
    }
  }, [days])

  const shown = result !== null && result.days === days ? result : null

  let body
  if (shown === null) {
    body = <p className="page-subtext">{t('muscleStats.loading')}</p>
  } else if (shown.error || shown.stats === null) {
    body = (
      <p className="error-text" role="alert">
        {translateError(shown.error, 'muscleStats.loadFailed')}
      </p>
    )
  } else if (shown.stats.totalSets === 0) {
    body = (
      <p className="page-subtext">
        {days === 'all' ? t('muscleStats.emptyAll') : t('muscleStats.emptyWindow', { days })}{' '}
        {t('muscleStats.startHint')}
      </p>
    )
  } else {
    const { groups, totalSets } = shown.stats
    // Most-trained first; Array.sort is stable, so ties keep the server's order.
    const sorted = [...groups].sort((a, b) => b.sets - a.sets)
    const max = sorted[0].sets
    body = (
      <>
        <p className="muscle-total">{t('muscleStats.total', { count: totalSets })}</p>
        <ul className="muscle-list">
          {sorted.map((group) => (
            <li key={group.muscleGroup} className="muscle-row">
              <span className="muscle-name">{muscleGroupLabel(group.muscleGroup)}</span>
              <span
                className="muscle-bar"
                role="img"
                aria-label={t('muscleStats.setsCount', { count: group.sets })}
              >
                <span className="muscle-bar-fill" style={{ width: `${(group.sets / max) * 100}%` }} />
              </span>
              <span className="muscle-count">{group.sets}</span>
            </li>
          ))}
        </ul>
        <p className="page-subtext">{t('muscleStats.note')}</p>
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card dashboard-card">
        <Link to="/" className="history-back">
          {t('muscleStats.back')}
        </Link>
        <h1>{t('muscleStats.title')}</h1>
        <div className="dashboard-toggle" role="group" aria-label={t('dashboard.windowLabel')}>
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn-secondary"
              aria-pressed={days === option.value}
              onClick={() => setDays(option.value)}
            >
              {option.label ?? t('dashboard.windowAll')}
            </button>
          ))}
        </div>
        <div aria-live="polite">{body}</div>
      </main>
    </div>
  )
}
