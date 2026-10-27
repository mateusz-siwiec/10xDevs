import { useEffect, useState } from 'react'
import { getProgressionRecommendation } from '../api/client'
import type { ProgressionRecommendation as Recommendation } from '../api/client'

interface ProgressionRecommendationProps {
  exerciseId: string
}

interface FetchResult {
  key: string
  recommendation: Recommendation | null
}

export default function ProgressionRecommendation({ exerciseId }: ProgressionRecommendationProps) {
  const [result, setResult] = useState<FetchResult | null>(null)

  // State is only set from async callbacks; a cancelled flag drops stale responses.
  // The recommendation is advisory, so errors are treated the same as "no recommendation".
  useEffect(() => {
    let cancelled = false
    getProgressionRecommendation(exerciseId)
      .then((recommendation) => {
        if (!cancelled) setResult({ key: exerciseId, recommendation })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: exerciseId, recommendation: null })
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId])

  const recommendation = result !== null && result.key === exerciseId ? result.recommendation : null
  if (recommendation === null) {
    return null
  }

  return (
    <section className="workout-section progression-recommendation" aria-live="polite">
      <p>
        Try {recommendation.recommendedWeightKg} kg — you completed {recommendation.targetSets}×
        {recommendation.targetReps} at {recommendation.currentWeightKg} kg in your last{' '}
        {recommendation.workouts} workouts.
      </p>
    </section>
  )
}
