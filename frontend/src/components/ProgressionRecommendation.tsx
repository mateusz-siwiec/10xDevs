import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  // The live region stays mounted so screen readers announce the hint when it appears.
  return (
    <div aria-live="polite">
      {recommendation !== null && (
        <section className="workout-section progression-recommendation">
          <p>
            {t('workout.recommendation', {
              weight: recommendation.recommendedWeightKg,
              sets: recommendation.targetSets,
              reps: recommendation.targetReps,
              previousWeight: recommendation.currentWeightKg,
              count: recommendation.workouts,
            })}
          </p>
        </section>
      )}
    </div>
  )
}
