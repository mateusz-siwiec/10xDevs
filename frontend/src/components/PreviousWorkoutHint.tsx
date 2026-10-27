import { useEffect, useState } from 'react'
import { getPreviousWorkout } from '../api/client'
import type { PreviousWorkout } from '../api/client'

interface PreviousWorkoutHintProps {
  exerciseId: string
  planId: string
  /** 1-based number of the set about to be logged for this exercise in the current workout. */
  setNumber: number
}

interface FetchResult {
  key: string
  previous: PreviousWorkout | null
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

export default function PreviousWorkoutHint({ exerciseId, planId, setNumber }: PreviousWorkoutHintProps) {
  const [result, setResult] = useState<FetchResult | null>(null)
  const key = `${exerciseId}:${planId}`

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  // The hint is advisory, so errors are treated the same as "no previous workout".
  useEffect(() => {
    let cancelled = false
    const requestKey = `${exerciseId}:${planId}`
    getPreviousWorkout(exerciseId, planId)
      .then((previous) => {
        if (!cancelled) setResult({ key: requestKey, previous })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, previous: null })
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId, planId])

  const previous = result !== null && result.key === key ? result.previous : null

  // The live region stays mounted so screen readers announce the hint when it appears.
  return (
    <div aria-live="polite">
      {previous && previous.sets.length > 0 && (
        <section className="workout-section previous-workout-hint">
          <p>Last time ({dateFormat.format(new Date(previous.endedAt))}):</p>
          <ol>
            {previous.sets.map((set, index) => (
              <li
                key={index}
                className={index + 1 === setNumber ? 'previous-workout-hint-current' : undefined}
                aria-current={index + 1 === setNumber ? 'step' : undefined}
              >
                Set {index + 1}: {set.reps} × {set.weightKg} kg
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
