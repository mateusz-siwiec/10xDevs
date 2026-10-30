import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getProgression } from '../api/client'
import type { ProgressionPoint } from '../api/client'
import i18n from '../i18n'
import { translateError } from '../utils/errors'
import { axisProps, gridProps, seriesColor, tooltipProps } from './chartTheme'

interface ProgressionChartProps {
  exerciseId: string
  refreshKey: number
}

interface FetchResult {
  key: string
  points: ProgressionPoint[]
  error: unknown
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-GB', { month: 'short', day: 'numeric' })
}

export default function ProgressionChart({ exerciseId, refreshKey }: ProgressionChartProps) {
  const { t } = useTranslation() // also re-renders on language change so axis dates are reformatted
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
            error: err,
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
    body = <p className="page-subtext">{t('progression.loading')}</p>
  } else if (shown.error !== null) {
    body = <p className="error-text">{translateError(shown.error, 'progression.loadFailed')}</p>
  } else if (shown.points.length === 0) {
    body = <p className="page-subtext">{t('progression.empty')}</p>
  } else {
    body = (
      <div className="progression-chart-body">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={shown.points} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={formatDate} {...axisProps} />
            <YAxis
              unit=" kg"
              width={56}
              domain={['auto', 'auto']}
              allowDecimals
              {...axisProps}
            />
            <Tooltip
              {...tooltipProps}
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => [`${value} kg`, t('progression.topWeight')]}
            />
            <Line
              type="monotone"
              dataKey="topWeightKg"
              stroke={seriesColor}
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
      <h2>{t('progression.title')}</h2>
      {body}
    </section>
  )
}
