import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, MouseEvent as ReactMouseEvent, PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Exercise } from '../api/client'
import { exerciseName, exerciseTechnique } from '../utils/exercises'
import MuscleMap from './MuscleMap'

interface TechniqueTooltipProps {
  exercise: Pick<Exercise, 'slug' | 'name' | 'primaryMuscleGroup' | 'secondaryMuscleGroups'>
}

/** Minimum gap kept between the panel and the viewport edge, in px (1rem at the default font size). */
const EDGE_GAP = 16

/** Must match the phone breakpoint of the bottom-sheet layout in page.css. */
const PHONE_QUERY = '(max-width: 40rem)'

/**
 * Info button that reveals the form cues for an exercise. Opens on hover and keyboard focus, toggles on tap/click;
 * closes on Escape (focus returns to the button), outside mousedown or focus leaving. Shows the muscle map and, for
 * seeded exercises, the cues; renders nothing when there is neither.
 */
export default function TechniqueTooltip({ exercise }: TechniqueTooltipProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const panelId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const pointerType = useRef('')

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Hover-only openings must not pull focus away from what the user is working in.
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // On phones the open panel is a bottom sheet over a dimmed backdrop: lock page scrolling so the user can't lose
  // track of which exercise it belongs to (the title in the sheet names it).
  useEffect(() => {
    if (!open || !window.matchMedia(PHONE_QUERY).matches) return
    const { overflow, paddingRight } = document.body.style
    // Hiding the page scrollbar would widen the layout and make the page jump; pad by its width to keep it put.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [open])

  // Keep the panel inside the viewport: measure it unshifted, then nudge it back by the overflow.
  // Re-measured on resize/rotation while open and reset on close, so a stale shift never carries over.
  useLayoutEffect(() => {
    if (!open) return
    function measure() {
      const panel = panelRef.current
      if (!panel) return
      panel.style.left = '0px'
      const rect = panel.getBoundingClientRect()
      const viewport = document.documentElement.clientWidth
      let next = 0
      if (rect.right > viewport - EDGE_GAP) next = viewport - EDGE_GAP - rect.right
      if (rect.left + next < EDGE_GAP) next = EDGE_GAP - rect.left
      panel.style.left = ''
      setShift(next)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      setShift(0)
    }
  }, [open])

  const cues = exerciseTechnique(exercise)
  if (!cues && !exercise.primaryMuscleGroup) return null

  function onFocus(event: FocusEvent) {
    // Only keyboard focus opens it; a tap or click also focuses the button and then toggles via onClick.
    if ((event.target as HTMLElement).matches(':focus-visible')) setOpen(true)
  }

  function onBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null
    const root = rootRef.current
    if (!root || (next && root.contains(next))) return
    // A null relatedTarget (browser chrome, another window) closes it too, but not while the pointer is over the
    // component: clicking plain text inside the panel also blurs with a null relatedTarget.
    if (!root.matches(':hover')) setOpen(false)
  }

  function onPointerEnter(event: PointerEvent) {
    // In the phone layout the panel is a modal sheet whose backdrop covers the trigger, so hovering must not open it
    // (the next click would land on the backdrop and close it again): there it opens on click/tap only.
    if (event.pointerType !== 'touch' && !window.matchMedia(PHONE_QUERY).matches) setOpen(true)
  }

  function onPointerLeave(event: PointerEvent) {
    // A press that never produced a click (dragged off the button) must not leave a stale pointer type behind.
    pointerType.current = ''
    if (event.pointerType === 'touch') return
    const active = document.activeElement
    const keyboardInside = active && rootRef.current?.contains(active) && active.matches(':focus-visible')
    if (!keyboardInside) setOpen(false)
  }

  function onClick(event: ReactMouseEvent) {
    // A mouse click lands while hover already opened it, and a keyboard click (detail 0) lands after focus opened it;
    // keep it open in both cases (Escape or tabbing away closes it). Only touch toggles.
    if (pointerType.current === 'mouse' || event.detail === 0) setOpen(true)
    else setOpen((value) => !value)
    pointerType.current = ''
  }

  // The panel (div/p/ul) is rendered inside the name spans of the list rows, which is technically invalid HTML nesting.
  // Accepted on purpose: browsers handle it, and a real <ul> beats strict nesting for screen readers.
  return (
    <span
      className="technique-tooltip"
      ref={rootRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <button
        type="button"
        ref={buttonRef}
        className="technique-trigger"
        aria-label={
          cues
            ? t('exercises.techniqueLabel', { name: exerciseName(exercise) })
            : t('exercises.musclesLabel', { name: exerciseName(exercise) })
        }
        aria-expanded={open}
        aria-describedby={open ? panelId : undefined}
        onPointerDown={(event) => {
          pointerType.current = event.pointerType
        }}
        onClick={onClick}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.25V11" />
          <path d="M8 4.75h.01" />
        </svg>
      </button>
      {open && <span className="technique-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />}
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="tooltip"
          className="technique-panel"
          style={shift ? { left: `${shift}px` } : undefined}
        >
          <div className="technique-panel-head">
            <span className="technique-panel-title">{exerciseName(exercise)}</span>
            <button
              type="button"
              className="technique-close"
              aria-label={t('exercises.closeInfo')}
              onClick={() => {
                setOpen(false)
                buttonRef.current?.focus()
              }}
            >
              ×
            </button>
          </div>
          {exercise.primaryMuscleGroup && (
            <>
              <p className="technique-heading">{t('exercises.musclesHeading')}</p>
              <MuscleMap primary={exercise.primaryMuscleGroup} secondary={exercise.secondaryMuscleGroups} />
            </>
          )}
          {cues && (
            <div className={exercise.primaryMuscleGroup ? 'technique-cues' : undefined}>
              <p className="technique-heading">{t('exercises.techniqueHeading')}</p>
              <ul className="technique-list">
                {cues.map((cue) => (
                  <li key={cue}>{cue}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
