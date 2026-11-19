import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Exercise } from '../api/client'

interface SetLoggerProps {
  disabled: boolean
  /** The selected exercise; its weight mode decides whether the weight field is required, optional or hidden. */
  exercise?: Exercise
  onLog: (reps: number, weightKg: number | undefined, toFailure: boolean) => Promise<void>
}

export default function SetLogger({ disabled, exercise, onLog }: SetLoggerProps) {
  const { t } = useTranslation()
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [toFailure, setToFailure] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const weightMode = exercise?.weightMode ?? 'REQUIRED'
  const showWeight = weightMode !== 'NONE'

  // Reps and weight are kept after logging (consecutive sets are usually similar) and
  // after a failure, so the user can correct them. "To failure" is per set: it resets
  // after a successful log and is kept when the log fails, so the user can retry.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onLog(Number(reps), showWeight && weight !== '' ? Number(weight) : undefined, toFailure)
      setToFailure(false)
    } catch {
      // the page surfaces the error inline
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="set-logger-fields">
        <div className="field">
          <label htmlFor="set-reps">{t('workout.reps')}</label>
          <input
            id="set-reps"
            type="number"
            inputMode="numeric"
            step="1"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            required
          />
        </div>
        {showWeight && (
          <div className="field">
            <label htmlFor="set-weight">
              {t(weightMode === 'OPTIONAL' ? 'workout.weightKgOptional' : 'workout.weightKg')}
            </label>
            <input
              id="set-weight"
              type="number"
              inputMode="decimal"
              step="0.25"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              required={weightMode === 'REQUIRED'}
            />
          </div>
        )}
        <label className="check-field" htmlFor="set-to-failure">
          <input
            id="set-to-failure"
            type="checkbox"
            checked={toFailure}
            onChange={(event) => setToFailure(event.target.checked)}
            disabled={disabled || submitting}
          />
          {t('workout.toFailure')}
        </label>
      </div>
      <button type="submit" disabled={disabled || submitting} className="btn-primary">
        {submitting ? t('workout.logging') : t('workout.logSet')}
      </button>
    </form>
  )
}
