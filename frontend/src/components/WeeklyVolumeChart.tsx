import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyVolume } from '../api/client'
import { formatNumber, formatShortDate } from '../utils/format'

interface WeeklyVolumeChartProps {
  weeks: WeeklyVolume[]
}

export default function WeeklyVolumeChart({ weeks }: WeeklyVolumeChartProps) {
  const { t } = useTranslation()
  const hasData = weeks.some((week) => week.volumeKg > 0)
  const totalKg = weeks.reduce((sum, week) => sum + week.volumeKg, 0)
  const bestKg = Math.max(0, ...weeks.map((week) => week.volumeKg))
  const summary = t('dashboard.weeklyVolume.summary', {
    count: weeks.length,
    total: formatNumber(totalKg),
    best: formatNumber(bestKg),
  })

  return (
    <section className="dashboard-section">
      <h2>{t('dashboard.weeklyVolume.title')}</h2>
      {hasData ? (
        <div role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weeks} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="weekStart" tickFormatter={formatShortDate} tick={{ fontSize: 12 }} />
              <YAxis width={56} tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => t('dashboard.weeklyVolume.weekOf', { date: formatShortDate(String(label)) })}
                formatter={(value) => [
                  `${formatNumber(Number(value))} kg`,
                  t('dashboard.weeklyVolume.volume'),
                ]}
              />
              <Bar dataKey="volumeKg" fill="var(--accent)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="page-subtext">{t('dashboard.weeklyVolume.empty')}</p>
      )}
    </section>
  )
}
