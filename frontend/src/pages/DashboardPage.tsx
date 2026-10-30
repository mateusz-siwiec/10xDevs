import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getDashboardInsights, getDashboardStats, getExercises, setWeeklyGoal } from '../api/client'
import type { DashboardInsights, DashboardStats, Exercise, StatsWindow } from '../api/client'
import ConsistencyCard from '../components/ConsistencyCard'
import RecentRecords from '../components/RecentRecords'
import WeeklyVolumeChart from '../components/WeeklyVolumeChart'
import { formatDuration, formatVolume } from '../utils/format'
import '../styles/page.css'
import '../styles/dashboard.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'

interface FetchResult {
  days: StatsWindow
  stats: DashboardStats | null
  error: unknown
}

interface InsightsResult {
  insights: DashboardInsights | null
  error: unknown
}

const WINDOW_OPTIONS: { value: StatsWindow; label: string | null }[] = [
  { value: 7, label: '7' },
  { value: 30, label: '30' },
  { value: 90, label: '90' },
  { value: 'all', label: null },
]

/** Whole-number percentage change; null when there is no previous window or it was 0. */
function percentDelta(current: number, previous: number | undefined): number | null {
  if (previous === undefined) return null
  const cur = Number(current)
  const prev = Number(previous)
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function Delta({ current, previous }: { current: number; previous: number | undefined }) {
  const { t } = useTranslation()
  const delta = percentDelta(current, previous)
  if (delta === null) return null
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
  return (
    <span className="dashboard-delta" data-direction={direction}>
      {arrow} {t('dashboard.deltaVsPrevious', { percent: Math.abs(delta) })}
    </span>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState<StatsWindow>(7)
  const [result, setResult] = useState<FetchResult | null>(null)
  const [insightsResult, setInsightsResult] = useState<InsightsResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [goalError, setGoalError] = useState<ErrorInfo | null>(null)
  const [insightsAttempt, setInsightsAttempt] = useState(0)
  const [exercises, setExercises] = useState<Exercise[]>([])

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    getDashboardStats(days)
      .then((stats) => {
        if (!cancelled) setResult({ days, stats, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            days,
            stats: null,
            error: err,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [days])

  // Insights are independent of the window toggle, so they load on mount (and on an explicit retry).
  useEffect(() => {
    let cancelled = false
    getDashboardInsights()
      .then((insights) => {
        if (!cancelled) setInsightsResult({ insights, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setInsightsResult({
            insights: null,
            error: err,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [insightsAttempt])

  // Only used to show translated exercise names in recent records; on failure the stored names are shown.
  useEffect(() => {
    let cancelled = false
    getExercises()
      .then((list) => {
        if (!cancelled) setExercises(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSaveGoal(goal: number | null) {
    setSaving(true)
    setGoalError(null)
    try {
      const saved = await setWeeklyGoal(goal)
      try {
        // The streak is computed server-side, so refetch rather than recompute locally.
        const insights = await getDashboardInsights()
        setInsightsResult({ insights, error: null })
      } catch {
        // The goal is saved; only the refresh failed, so keep the old numbers with the new goal.
        setInsightsResult((prev) =>
          prev?.insights
            ? {
                insights: {
                  ...prev.insights,
                  streak: { ...prev.insights.streak, goal: saved.weeklyGoal },
                },
                error: null,
              }
            : prev,
        )
      }
    } catch (err) {
      setGoalError({ err, key: 'dashboard.goalSaveFailed' })
    } finally {
      setSaving(false)
    }
  }

  const shown = result !== null && result.days === days ? result : null

  let body
  if (shown === null) {
    body = (
      <div role="status">
        <span className="visually-hidden">{t('dashboard.loading')}</span>
        <div className="dashboard-tiles" aria-hidden="true">
          <div className="skeleton skeleton-tile" />
          <div className="skeleton skeleton-tile" />
          <div className="skeleton skeleton-tile" />
        </div>
      </div>
    )
  } else if (shown.error || shown.stats === null) {
    body = (
      <p className="error-text" role="alert">
        {translateError(shown.error, 'dashboard.loadFailed')}
      </p>
    )
  } else if (shown.stats.workoutCount === 0) {
    body = (
      <p className="page-subtext">
        {days === 'all' ? t('dashboard.noWorkoutsAll') : t('dashboard.noWorkoutsWindow', { days })}{' '}
        {t('dashboard.startHint')}
      </p>
    )
  } else {
    const { stats } = shown
    body = (
      <div className="dashboard-tiles">
        <div className="dashboard-tile card">
          <span className="stat-label">{t('dashboard.tileWorkouts')}</span>
          <span className="stat-value">{stats.workoutCount}</span>
          <Delta current={stats.workoutCount} previous={stats.previous?.workoutCount} />
        </div>
        <div className="dashboard-tile card">
          <span className="stat-label">{t('dashboard.tileTime')}</span>
          <span className="stat-value">{formatDuration(stats.totalDurationSeconds)}</span>
          <Delta current={stats.totalDurationSeconds} previous={stats.previous?.totalDurationSeconds} />
        </div>
        <div className="dashboard-tile card">
          <span className="stat-label">{t('dashboard.tileVolume')}</span>
          <span className="stat-value">{formatVolume(stats.totalVolumeKg)}</span>
          <Delta current={stats.totalVolumeKg} previous={stats.previous?.totalVolumeKg} />
        </div>
      </div>
    )
  }

  let insightsBody
  if (insightsResult === null) {
    insightsBody = (
      <div role="status">
        <span className="visually-hidden">{t('dashboard.insightsLoading')}</span>
        <div className="dashboard-section" aria-hidden="true">
          <div className="skeleton skeleton-chart" />
        </div>
        <div className="dashboard-section" aria-hidden="true">
          <div className="skeleton skeleton-card" />
        </div>
        <div className="dashboard-section" aria-hidden="true">
          <div className="skeleton skeleton-card" />
        </div>
      </div>
    )
  } else if (insightsResult.error || insightsResult.insights === null) {
    insightsBody = (
      <>
        <p className="error-text" role="alert">
          {translateError(insightsResult.error, 'dashboard.insightsFailed')}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setInsightsResult(null)
            setInsightsAttempt((attempt) => attempt + 1)
          }}
        >
          {t('common.retry')}
        </button>
      </>
    )
  } else {
    const { insights } = insightsResult
    insightsBody = (
      <>
        <WeeklyVolumeChart weeks={insights.weeklyVolume} />
        <ConsistencyCard
          key={insights.streak.goal ?? 'none'}
          streak={insights.streak}
          saving={saving}
          error={goalError}
          onSaveGoal={handleSaveGoal}
        />
        <RecentRecords records={insights.recentPersonalRecords} exercises={exercises} />
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card dashboard-card">
        <h1>{t('dashboard.title')}</h1>
        <Link to="/workout" className="btn-primary dashboard-start">
          {t('dashboard.startWorkout')}
        </Link>
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
        {insightsBody}
        <Link to="/muscle-groups" className="btn-secondary dashboard-start">
          {t('dashboard.muscleStatsLink')}
        </Link>
      </main>
    </div>
  )
}
