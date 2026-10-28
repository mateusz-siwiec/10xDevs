import i18n from '../i18n'

export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalSeconds > 0 && totalMinutes === 0) {
    return i18n.t('common.duration.lessThanMinute')
  }
  return hours > 0
    ? i18n.t('common.duration.hoursMinutes', { hours, minutes })
    : i18n.t('common.duration.minutes', { minutes })
}

export function formatVolume(kg: number): string {
  return `${kg.toLocaleString(i18n.language, { maximumFractionDigits: 1 })} kg`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
