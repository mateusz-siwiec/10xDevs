import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getHistory, listPlans } from '../api/client'
import type { HistoryPage as HistoryPageData, PlanSummary } from '../api/client'
import '../styles/page.css'
import '../styles/history.css'

interface FetchResult {
  key: string
  data: HistoryPageData | null
  error: string | null
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function parsePage(raw: string | null): number {
  if (raw === null || !/^\d+$/.test(raw)) return 1
  const n = Number(raw)
  return n >= 1 ? n : 1
}

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const plan = searchParams.get('plan') ?? ''
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [result, setResult] = useState<FetchResult | null>(null)

  useEffect(() => {
    let cancelled = false
    listPlans()
      .then((list) => {
        if (!cancelled) setPlans(list)
      })
      .catch(() => {
        // a failing plan list leaves just "All workouts" and "No plan"
      })
    return () => {
      cancelled = true
    }
  }, [])

  const key = `${page}:${plan}`

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    const filter = plan === 'none' ? { noPlan: true } : plan ? { planId: plan } : {}
    getHistory(page - 1, filter)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key,
            data: null,
            error: err instanceof Error ? err.message : 'Failed to load history',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [key, page, plan])

  function updateParams(nextPage: number, nextPlan: string) {
    const params = new URLSearchParams()
    if (nextPlan) params.set('plan', nextPlan)
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
  }

  const shown = result !== null && result.key === key ? result : null

  let body
  if (shown === null) {
    body = <p className="page-subtext">Loading history…</p>
  } else if (shown.error || shown.data === null) {
    body = (
      <p className="error-text" role="alert">
        {shown.error ?? 'Failed to load history'}
      </p>
    )
  } else if (shown.data.items.length === 0) {
    body = (
      <p className="page-subtext">
        {plan === '' && page === 1
          ? 'No completed workouts yet.'
          : 'No completed workouts for this filter.'}
      </p>
    )
  } else {
    const { items, totalPages } = shown.data
    body = (
      <>
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/history/${item.id}`} className="history-row">
                <span className="history-row-date">
                  {formatDate(item.startedAt)}
                  {item.planName && <span className="history-row-plan"> · {item.planName}</span>}
                </span>
                <span className="history-row-meta">
                  <span>{formatDuration(item.durationSeconds)}</span>
                  <span>
                    {item.setCount} {item.setCount === 1 ? 'set' : 'sets'}
                  </span>
                  <span>{formatVolume(item.volumeKg)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="history-pager">
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => updateParams(page - 1, plan)}
          >
            Prev
          </button>
          <span className="history-pager-label">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => updateParams(page + 1, plan)}
          >
            Next
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="page-shell">
      <main className="page-card history-card">
        <h1>History</h1>
        <div className="history-filter">
          <label htmlFor="history-plan">Plan</label>
          <select
            id="history-plan"
            value={plan}
            onChange={(e) => updateParams(1, e.target.value)}
          >
            <option value="">All workouts</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="none">No plan</option>
          </select>
        </div>
        <div aria-live="polite">{body}</div>
      </main>
    </div>
  )
}
