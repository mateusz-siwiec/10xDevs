import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getProgression } from '../api/client'
import type { ProgressionPoint } from '../api/client'

interface ProgressionChartProps {
  exerciseId: string
  refreshKey: number
}

interface FetchResult {
  key: string
  points: ProgressionPoint[]
  error: string | null
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ProgressionChart({ exerciseId, refreshKey }: ProgressionChartProps) {
  const [result, setResult] = useState<FetchResult | null>(null)
  const requestKey = `${exerciseId}:${refreshKey}`

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  useEffect(() => {
    let cancelled = false
    getProgression(exerciseId)
      .then((points) => {
        if (!cancelled) setResult({ key: requestKey, points, error: null })
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            points: [],
            error: err instanceof Error ? err.message : 'Failed to load progression',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId, requestKey])

  // Keep showing the previous chart while a refresh for the same exercise is in flight.
  const sameExercise = result !== null && result.key.startsWith(`${exerciseId}:`)
  const current = result !== null && result.key === requestKey ? result : null

  const shown = current ?? (sameExercise ? result : null)

  let body
  if (shown === null) {
    body = <p className="page-subtext">Loading progression…</p>
  } else if (shown.error) {
    body = <p className="error-text">{shown.error}</p>
  } else if (shown.points.length === 0) {
    body = <p className="page-subtext">No history for this exercise yet. Log a set to start the chart.</p>
  } else {
    body = (
      <div className="progression-chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={shown.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
            <YAxis
              unit=" kg"
              width={56}
              tick={{ fontSize: 12 }}
              domain={['auto', 'auto']}
              allowDecimals
            />
            <Tooltip
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => [`${value} kg`, 'Top weight']}
            />
            <Line
              type="monotone"
              dataKey="topWeightKg"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <section className="workout-section progression-chart">
      <h2>Progression</h2>
      {body}
    </section>
  )
}
