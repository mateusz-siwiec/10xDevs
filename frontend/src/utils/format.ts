import i18n from '../i18n'

/** BCP 47 locale for the active app language, so formats follow it rather than the browser. */
export function appLocale(): string {
  return i18n.language === 'pl' ? 'pl-PL' : 'en-GB'
}

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

export function formatNumber(value: number): string {
  return value.toLocaleString(appLocale(), { maximumFractionDigits: 1 })
}

export function formatVolume(kg: number): string {
  return `${formatNumber(kg)} kg`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(appLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Short "day month" date without the year; returns the input unchanged when it isn't a date. */
export function formatShortDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(appLocale(), { month: 'short', day: 'numeric' })
}
