export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalSeconds > 0 && totalMinutes === 0) {
    return '<1m'
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function formatVolume(kg: number): string {
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
