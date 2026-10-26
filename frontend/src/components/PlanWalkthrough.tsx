import type { EntryProgress } from './planProgress'
import { currentIndex } from './planProgress'

interface PlanWalkthroughProps {
  progress: EntryProgress[]
  selectedExerciseId: string
  onSelect: (exerciseId: string) => void
}

export default function PlanWalkthrough({
  progress,
  selectedExerciseId,
  onSelect,
}: PlanWalkthroughProps) {
  const current = currentIndex(progress)

  return (
    <ol className="walkthrough-list">
      {progress.map(({ entry, logged }, index) => {
        const done = logged >= entry.sets
        const classes = ['walkthrough-entry']
        if (entry.exerciseId === selectedExerciseId) classes.push('walkthrough-entry-selected')
        if (index === current) classes.push('walkthrough-entry-current')
        if (done) classes.push('walkthrough-entry-done')
        return (
          <li key={entry.position}>
            <button
              type="button"
              className={classes.join(' ')}
              aria-current={index === current ? 'step' : undefined}
              onClick={() => onSelect(entry.exerciseId)}
            >
              <span className="walkthrough-entry-info">
                <span className="walkthrough-entry-name">{entry.exerciseName}</span>
                <span>
                  {entry.sets} × {entry.reps}
                </span>
              </span>
              <span className="walkthrough-entry-progress">
                {done ? '✓ ' : ''}
                {logged}/{entry.sets}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
