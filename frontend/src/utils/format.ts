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

/** Seconds as shown everywhere sets are listed: "45 s" (plain seconds, matching the 1-3600 input). */
export function formatSeconds(seconds: number): string {
  return i18n.t('common.secondsCount', { seconds })
}

/**
 * One set as shown in lists: "8 × 60 kg", "8 reps" when no weight was added, "45 s" for a timed set,
 * or "45 s × 10 kg" for a timed set with added weight.
 */
export function formatSet({
  reps,
  durationSeconds,
  weightKg,
}: {
  reps: number | null
  durationSeconds?: number | null
  weightKg: number
}): string {
  if (durationSeconds != null) {
    return weightKg > 0
      ? `${formatSeconds(durationSeconds)} × ${weightKg} kg`
      : formatSeconds(durationSeconds)
  }
  const count = reps ?? 0
  return weightKg > 0 ? `${count} × ${weightKg} kg` : i18n.t('common.repsCount', { count })
}
