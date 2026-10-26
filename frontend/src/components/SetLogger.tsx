import { useState } from 'react'
import type { FormEvent } from 'react'

interface SetLoggerProps {
  disabled: boolean
  onLog: (reps: number, weightKg: number) => Promise<void>
}

export default function SetLogger({ disabled, onLog }: SetLoggerProps) {
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Values are kept after logging (consecutive sets are usually similar) and
  // after a failure, so the user can correct them.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onLog(Number(reps), Number(weight))
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
          <label htmlFor="set-reps">Reps</label>
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
        <div className="field">
          <label htmlFor="set-weight">Weight (kg)</label>
          <input
            id="set-weight"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            required
          />
        </div>
      </div>
      <button type="submit" disabled={disabled || submitting} className="btn-primary">
        {submitting ? 'Logging…' : 'Log set'}
      </button>
    </form>
  )
}
