export interface PlanEditorEntry {
  key: string
  exerciseId: string
  exerciseName: string
}

interface PlanExerciseListProps {
  entries: PlanEditorEntry[]
  disabled: boolean
  onMove: (index: number, delta: -1 | 1) => void
  onRemove: (key: string) => void
}

export default function PlanExerciseList({
  entries,
  disabled,
  onMove,
  onRemove,
}: PlanExerciseListProps) {
  if (entries.length === 0) {
    return <p className="page-subtext">No exercises added yet.</p>
  }

  return (
    <ol className="plan-exercise-list">
      {entries.map((entry, index) => (
        <li key={entry.key} className="plan-exercise-item">
          <span className="plan-exercise-name">{entry.exerciseName}</span>
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
