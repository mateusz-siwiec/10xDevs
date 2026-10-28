import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyVolume } from '../api/client'

interface WeeklyVolumeChartProps {
  weeks: WeeklyVolume[]
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function WeeklyVolumeChart({ weeks }: WeeklyVolumeChartProps) {
  const hasData = weeks.some((week) => week.volumeKg > 0)

  return (
    <section className="dashboard-section">
      <h2>Weekly volume</h2>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeks} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="weekStart" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
            <YAxis width={56} tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              labelFormatter={(label) => `Week of ${formatDate(String(label))}`}
              formatter={(value) => [
                `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`,
                'Volume',
              ]}
            />
            <Bar dataKey="volumeKg" fill="var(--accent)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="page-subtext">No volume logged in the last 12 weeks.</p>
      )}
    </section>
  )
}
