import { useState } from 'react'
import type { WorkoutSet } from '../api/client'

interface SessionSetListProps {
  sets: WorkoutSet[]
  exerciseNames: Map<string, string>
  onDelete: (setId: string) => Promise<void>
}

export default function SessionSetList({ sets, exerciseNames, onDelete }: SessionSetListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  if (sets.length === 0) {
    return <p className="page-subtext">No sets logged yet.</p>
  }

  async function confirmDelete(setId: string) {
    try {
      await onDelete(setId)
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <ul className="set-list">
      {sets.map((set) => (
        <li key={set.id} className="set-item">
          <div className="set-item-info">
            <span className="set-item-name">{exerciseNames.get(set.exerciseId) ?? 'Unknown exercise'}</span>
            <span>
              {set.reps} × {set.weightKg} kg
              {set.personalRecord && (
                <span className="pr-badge" role="img" aria-label="New personal record">
                  PR
                </span>
              )}
            </span>
          </div>
          {confirmingId === set.id ? (
            <div className="set-item-actions">
              <button type="button" className="btn-danger" onClick={() => confirmDelete(set.id)}>
                Confirm
              </button>
              <button type="button" className="btn-secondary" onClick={() => setConfirmingId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setConfirmingId(set.id)}>
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
