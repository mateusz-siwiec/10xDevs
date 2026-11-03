import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exerciseName } from '../utils/exercises'

export interface PlanEditorEntry {
  key: string
  exerciseId: string
  exerciseName: string
  exerciseSlug: string
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
  const { t } = useTranslation()
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const lastOffsets = useRef(new Map<string, number>())
  const movedKey = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // FLIP: after a reorder, slide each item from its old position to the new one and flash the moved item.
  // offsetTop is scroll-independent, so editing a field never triggers a false animation.
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const offsets = new Map<string, number>()
    itemRefs.current.forEach((el, key) => {
      offsets.set(key, el.offsetTop)
      const previous = lastOffsets.current.get(key)
      if (reduceMotion || previous === undefined) return
      if (previous !== el.offsetTop) {
        el.animate(
          [{ transform: `translateY(${previous - el.offsetTop}px)` }, { transform: 'translateY(0)' }],
          { duration: 250, easing: 'ease-out' },
        )
      }
      if (key === movedKey.current) {
        el.animate([{ backgroundColor: 'var(--accent-bg)' }, { backgroundColor: 'transparent' }], {
          duration: 900,
          easing: 'ease-out',
        })
      }
    })
    movedKey.current = null
    lastOffsets.current = offsets
  }, [entries])

  function handleMove(index: number, delta: -1 | 1) {
    const entry = entries[index]
    movedKey.current = entry.key
    setAnnouncement(
      t('plans.editor.movedTo', {
        name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }),
        position: index + delta + 1,
        total: entries.length,
      }),
    )
    onMove(index, delta)
  }

  if (entries.length === 0) {
    return <p className="page-subtext">{t('plans.editor.noExercises')}</p>
  }

  return (
    <>
    <p className="visually-hidden" aria-live="polite">
      {announcement}
    </p>
    <ol className="plan-exercise-list">
      {entries.map((entry, index) => (
        <li
          key={entry.key}
          className="plan-exercise-item"
          ref={(el) => {
            if (el) itemRefs.current.set(entry.key, el)
            else itemRefs.current.delete(entry.key)
          }}
        >
          <span className="plan-exercise-name">{exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName })}</span>
          <div className="plan-exercise-targets">
            <label className="plan-target-field">
              <span>{t('plans.editor.sets')}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('plans.editor.setsFor', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
                value={entry.sets}
                disabled={disabled}
                onChange={(event) => onTargetChange(entry.key, 'sets', event.target.value)}
              />
            </label>
            <label className="plan-target-field">
              <span>{t('plans.editor.reps')}</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label={t('plans.editor.repsFor', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
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
              aria-label={t('plans.editor.moveUpLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled || index === 0}
              onClick={() => handleMove(index, -1)}
            >
              {t('plans.editor.moveUp')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={t('plans.editor.moveDownLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled || index === entries.length - 1}
              onClick={() => handleMove(index, 1)}
            >
              {t('plans.editor.moveDown')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              aria-label={t('plans.editor.removeLabel', { name: exerciseName({ slug: entry.exerciseSlug, name: entry.exerciseName }) })}
              disabled={disabled}
              onClick={() => onRemove(entry.key)}
            >
              {t('plans.editor.remove')}
            </button>
          </div>
        </li>
      ))}
    </ol>
    </>
  )
}
