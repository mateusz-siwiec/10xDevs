import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getDashboardStats } from '../api/client'
import type { DashboardStats } from '../api/client'
import '../styles/page.css'
import '../styles/dashboard.css'

type DaysWindow = 7 | 30

interface FetchResult {
  days: DaysWindow
  stats: DashboardStats | null
  error: string | null
}

function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function formatVolume(kg: number): string {
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
}

export default function DashboardPage() {
  const [days, setDays] = useState<DaysWindow>(7)
  const [result, setResult] = useState<FetchResult | null>(null)

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

  const shown = result !== null && result.days === days ? result : null

  let body
  if (shown === null) {
    body = <p className="page-subtext">Loading stats…</p>
  } else if (shown.error || shown.stats === null) {
    body = <p className="error-text">{shown.error ?? 'Failed to load dashboard'}</p>
  } else if (shown.stats.workoutCount === 0) {
    body = (
      <p className="page-subtext">
        No completed workouts yet in the last {days} days. Start your first workout to see your stats here.
      </p>
    )
  } else {
    body = (
      <div className="dashboard-tiles">
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Workouts</span>
          <span className="dashboard-tile-value">{shown.stats.workoutCount}</span>
        </div>
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Time</span>
          <span className="dashboard-tile-value">{formatDuration(shown.stats.totalDurationSeconds)}</span>
        </div>
        <div className="dashboard-tile">
          <span className="dashboard-tile-label">Volume</span>
          <span className="dashboard-tile-value">{formatVolume(shown.stats.totalVolumeKg)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card dashboard-card">
        <h1>Dashboard</h1>
        <div className="dashboard-toggle" role="group" aria-label="Time window">
          {([7, 30] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="btn-secondary"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
            >
              {option} days
            </button>
          ))}
        </div>
        {body}
        <Link to="/workout" className="btn-primary dashboard-start">
          Start workout
        </Link>
      </main>
    </div>
  )
}
