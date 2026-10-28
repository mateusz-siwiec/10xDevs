import { useState } from 'react'
import type { Streak } from '../api/client'

interface ConsistencyCardProps {
  streak: Streak
  saving: boolean
  error: string | null
  onSaveGoal: (goal: number | null) => void
}

export default function ConsistencyCard({ streak, saving, error, onSaveGoal }: ConsistencyCardProps) {
  const [draft, setDraft] = useState(streak.goal !== null ? String(streak.goal) : '')

  const parsed = Number(draft)
  const draftValid = draft.trim() !== '' && Number.isInteger(parsed) && parsed >= 1 && parsed <= 14

  return (
    <section className="dashboard-section">
      <h2>Consistency</h2>
      {streak.goal === null ? (
        <p className="page-subtext">Set a weekly workout goal to start a streak.</p>
      ) : (
        <div className="consistency-summary">
          <span className="dashboard-tile-value">
            {streak.weeks} {streak.weeks === 1 ? 'week' : 'weeks'} streak
          </span>
          <span className="dashboard-tile-label">
            {streak.currentWeekWorkouts} of {streak.goal} this week
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
          Weekly goal (1-14)
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
          {saving ? 'Saving…' : 'Save'}
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
            Clear
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
