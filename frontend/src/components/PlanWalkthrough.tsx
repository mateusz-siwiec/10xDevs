import { useTranslation } from 'react-i18next'
import { exerciseName } from '../utils/exercises'
import type { EntryProgress } from './planProgress'
import { currentIndex, selectedIndex as findSelectedIndex } from './planProgress'

interface PlanWalkthroughProps {
  progress: EntryProgress[]
  selectedExerciseId: string
  skipped: ReadonlySet<number>
  onSelect: (exerciseId: string, position?: number) => void
  onSkip: (position: number) => void
}

export default function PlanWalkthrough({
  progress,
  selectedExerciseId,
  skipped,
  onSelect,
  onSkip,
}: PlanWalkthroughProps) {
  const { t } = useTranslation()
  const current = currentIndex(progress, skipped)
  // Highlight a single entry: the current one if it matches, else the first entry of that exercise.
  const selectedIndex = findSelectedIndex(progress, current, selectedExerciseId)

  return (
    <ol className="walkthrough-list">
      {progress.map(({ entry, logged }, index) => {
        const done = logged >= entry.sets
        const isSkipped = !done && skipped.has(entry.position)
        const classes = ['walkthrough-entry']
        if (index === selectedIndex) classes.push('walkthrough-entry-selected')
        if (index === current) classes.push('walkthrough-entry-current')
        if (done) classes.push('walkthrough-entry-done')
        if (isSkipped) classes.push('walkthrough-entry-skipped')
        return (
          <li key={entry.position}>
            <button
              type="button"
              className={classes.join(' ')}
              aria-current={index === current ? 'step' : undefined}
              onClick={() => onSelect(entry.exerciseId, entry.position)}
            >
              <span className="walkthrough-entry-info">
                <span className="walkthrough-entry-name">{exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName })}</span>
                <span>
                  {entry.sets} × {entry.reps}
                </span>
              </span>
              <span className="walkthrough-entry-progress">
                {isSkipped && <span className="pr-badge">{t('workout.skipped')}</span>}
                {done ? '✓ ' : ''}
                {logged}/{entry.sets}
              </span>
            </button>
            {index === selectedIndex && !done && (
              <button
                type="button"
                className="btn-secondary walkthrough-skip-btn"
                onClick={() => onSkip(entry.position)}
              >
                {t('workout.skip')}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
