export interface PlanEditorEntry {
  key: string
  exerciseId: string
  exerciseName: string
  sets: string
  reps: string
}

export type PlanTargetField = 'sets' | 'reps'

interface PlanExerciseListProps {
  entries: PlanEditorEntry[]
  disabled: boolean
  onMove: (index: number, delta: -1 | 1) => void
  onRemove: (key: string) => void
  onTargetChange: (key: string, field: PlanTargetField, value: string) => void
}

export default function PlanExerciseList({
  entries,
  disabled,
  onMove,
  onRemove,
  onTargetChange,
}: PlanExerciseListProps) {
  if (entries.length === 0) {
    return <p className="page-subtext">No exercises added yet.</p>
  }

  return (
    <ol className="plan-exercise-list">
      {entries.map((entry, index) => (
        <li key={entry.key} className="plan-exercise-item">
          <span className="plan-exercise-name">{entry.exerciseName}</span>
          <div className="plan-exercise-targets">
            <label className="plan-target-field">
              <span>Sets</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Sets for ${entry.exerciseName}`}
                value={entry.sets}
                disabled={disabled}
                onChange={(event) => onTargetChange(entry.key, 'sets', event.target.value)}
              />
            </label>
            <label className="plan-target-field">
              <span>Reps</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={`Reps for ${entry.exerciseName}`}
                value={entry.reps}
                disabled={disabled}
                onChange={(event) => onTargetChange(entry.key, 'reps', event.target.value)}
              />
            </label>
          </div>
          <div className="plan-exercise-actions">
            <button
              type="button"
              className="btn-secondary"
              aria-label={`Move ${entry.exerciseName} up`}
              disabled={disabled || index === 0}
              onClick={() => onMove(index, -1)}
            >
              Move up
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={`Move ${entry.exerciseName} down`}
              disabled={disabled || index === entries.length - 1}
              onClick={() => onMove(index, 1)}
            >
              Move down
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={`Remove ${entry.exerciseName}`}
              disabled={disabled}
              onClick={() => onRemove(entry.key)}
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
