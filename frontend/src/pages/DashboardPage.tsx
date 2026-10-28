import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getDashboardInsights, getDashboardStats, setWeeklyGoal } from '../api/client'
import type { DashboardInsights, DashboardStats, StatsWindow } from '../api/client'
import ConsistencyCard from '../components/ConsistencyCard'
import RecentRecords from '../components/RecentRecords'
import WeeklyVolumeChart from '../components/WeeklyVolumeChart'
import '../styles/page.css'
import '../styles/dashboard.css'

interface FetchResult {
  days: StatsWindow
  stats: DashboardStats | null
  error: string | null
}

interface InsightsResult {
  insights: DashboardInsights | null
  error: string | null
}

const WINDOW_OPTIONS: { value: StatsWindow; label: string }[] = [
  { value: 7, label: '7' },
  { value: 30, label: '30' },
  { value: 90, label: '90' },
  { value: 'all', label: 'All' },
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
  const delta = percentDelta(current, previous)
  if (delta === null) return null
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
  return (
    <span className="dashboard-delta" data-direction={direction}>
      {arrow} {Math.abs(delta)}% vs previous
    </span>
  )
}

function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalSeconds > 0 && totalMinutes === 0) {
    return '<1m'
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function formatVolume(kg: number): string {
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
}

export default function DashboardPage() {
  const [days, setDays] = useState<StatsWindow>(7)
  const [result, setResult] = useState<FetchResult | null>(null)
  const [insightsResult, setInsightsResult] = useState<InsightsResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)
  const [insightsAttempt, setInsightsAttempt] = useState(0)

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
            error: err instanceof Error ? err.message : 'Failed to load dashboard',
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
            error: err instanceof Error ? err.message : 'Failed to load insights',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [insightsAttempt])

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
      setGoalError(err instanceof Error ? err.message : 'Failed to save goal')
    } finally {
      setSaving(false)
    }
  }

  const shown = result !== null && result.days === days ? result : null

  let body
  if (shown === null) {
    body = <p className="page-subtext">Loading stats…</p>
  } else if (shown.error || shown.stats === null) {
    body = (
      <p className="error-text" role="alert">
        {shown.error ?? 'Failed to load dashboard'}
      </p>
    )
  } else if (shown.stats.workoutCount === 0) {
    body = (
      <p className="page-subtext">
        {days === 'all' ? 'No completed workouts yet.' : `No completed workouts in the last ${days} days.`} Start a
        workout to see your stats here.
      </p>
    )
  } else {
    const { stats } = shown
    body = (
      <div className="dashboard-tiles">
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Workouts</span>
          <span className="dashboard-tile-value">{stats.workoutCount}</span>
          <Delta current={stats.workoutCount} previous={stats.previous?.workoutCount} />
        </div>
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Time</span>
          <span className="dashboard-tile-value">{formatDuration(stats.totalDurationSeconds)}</span>
          <Delta current={stats.totalDurationSeconds} previous={stats.previous?.totalDurationSeconds} />
        </div>
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Volume</span>
          <span className="dashboard-tile-value">{formatVolume(stats.totalVolumeKg)}</span>
          <Delta current={stats.totalVolumeKg} previous={stats.previous?.totalVolumeKg} />
        </div>
      </div>
    )
  }

  let insightsBody
  if (insightsResult === null) {
    insightsBody = <p className="page-subtext">Loading insights…</p>
  } else if (insightsResult.error || insightsResult.insights === null) {
    insightsBody = (
      <>
        <p className="error-text" role="alert">
          {insightsResult.error ?? 'Failed to load insights'}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setInsightsResult(null)
            setInsightsAttempt((attempt) => attempt + 1)
          }}
        >
          Retry
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
        <RecentRecords records={insights.recentPersonalRecords} />
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card dashboard-card">
        <h1>Dashboard</h1>
        <div className="dashboard-toggle" role="group" aria-label="Time window (days)">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn-secondary"
              aria-pressed={days === option.value}
              onClick={() => setDays(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div aria-live="polite">{body}</div>
        {insightsBody}
        <Link to="/workout" className="btn-primary dashboard-start">
          Start workout
        </Link>
      </main>
    </div>
  )
}
