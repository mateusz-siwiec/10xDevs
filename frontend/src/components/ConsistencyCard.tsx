import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Streak } from '../api/client'

interface ConsistencyCardProps {
  streak: Streak
  saving: boolean
  error: string | null
  onSaveGoal: (goal: number | null) => void
}

export default function ConsistencyCard({ streak, saving, error, onSaveGoal }: ConsistencyCardProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(streak.goal !== null ? String(streak.goal) : '')

  const parsed = Number(draft)
  const draftValid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= 14

  return (
    <section className="dashboard-section">
      <h2>{t('dashboard.consistency.title')}</h2>
      {streak.goal === null ? (
        <p className="page-subtext">{t('dashboard.consistency.setGoalPrompt')}</p>
      ) : (
        <div className="consistency-summary">
          <span className="dashboard-tile-value">
            {t('dashboard.consistency.streak', { count: streak.weeks })}
          </span>
          <span className="dashboard-tile-label">
            {t('dashboard.consistency.thisWeek', { done: streak.currentWeekWorkouts, goal: streak.goal })}
          </span>
        </div>
      )}
      <form
        className="consistency-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (draftValid) onSaveGoal(parsed)
        }}
      >
        <label className="consistency-label">
          {t('dashboard.consistency.weeklyGoal')}
          <input
            type="number"
            min={1}
            max={14}
            step={1}
            inputMode="numeric"
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit" className="btn-secondary" disabled={saving || !draftValid}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {streak.goal !== null && (
          <button
            type="button"
            className="btn-secondary"
            disabled={saving}
            onClick={() => {
              setDraft('')
              onSaveGoal(null)
            }}
          >
            {t('common.clear')}
          </button>
        )}
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
