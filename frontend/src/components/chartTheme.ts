import type { CSSProperties } from 'react'

/** Single mapping from Recharts props to the --chart-* tokens (no literal colours here). */
const tickStyle = { fontSize: 12, fill: 'var(--chart-tick)' }

export const axisProps = {
  tick: tickStyle,
  axisLine: { stroke: 'var(--chart-grid)' },
  tickLine: { stroke: 'var(--chart-grid)' },
}

export const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'var(--chart-grid)',
}

const tooltipText: CSSProperties = { color: 'var(--chart-tick)' }

export const tooltipProps = {
  contentStyle: {
    background: 'var(--chart-tooltip-bg)',
    border: '1px solid var(--chart-tooltip-border)',
    borderRadius: 'var(--radius)',
  } satisfies CSSProperties,
  labelStyle: tooltipText,
  itemStyle: tooltipText,
}

export const seriesColor = 'var(--chart-bar)'
