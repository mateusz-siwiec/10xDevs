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

/** Gap between the trigger and the panel, in px (0.25rem). Bridged in page.css so the pointer can cross it. */
const PANEL_GAP = 4

/** Viewport coordinates of the open panel; `placement` tells which side of the trigger it opened on. */
interface PanelPosition {
  top: number
  left: number
  placement: 'below' | 'above' | 'right' | 'left'
}

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
  const [position, setPosition] = useState<PanelPosition | null>(null)
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

  // The panel is position: fixed, so opening it never lengthens the page (an absolutely positioned panel taller than the
  // room below its row did, and the page jumped back when it closed). Place it against the viewport instead: below the
  // trigger, or above it when it does not fit below; otherwise pin it inside the viewport (the panel scrolls itself).
  // Re-measured on resize and on scroll so it stays attached to its row, and reset on close so a stale position never
  // carries over. Phones use the bottom sheet from page.css and need no coordinates.
  useLayoutEffect(() => {
    if (!open) return
    let frame = 0
    function measure() {
      const root = rootRef.current
      const panel = panelRef.current
      if (!root || !panel) return
      if (window.matchMedia(PHONE_QUERY).matches) {
        setPosition(null)
        return
      }
      // Measure the panel's own size at a neutral spot, independent of where it currently sits, then put the inline
      // coordinates back: when the new position equals the old one React does not re-render to restore them.
      const { top: previousTop, left: previousLeft } = panel.style
      panel.style.top = '0px'
      panel.style.left = '0px'
      const { width, height } = panel.getBoundingClientRect()
      panel.style.top = previousTop
      panel.style.left = previousLeft

      const anchor = root.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      let left = Math.max(EDGE_GAP, Math.min(anchor.left, viewportWidth - EDGE_GAP - width))

      let top = anchor.bottom + PANEL_GAP
      let placement: PanelPosition['placement'] = 'below'
      if (top + height > viewportHeight - EDGE_GAP) {
        const above = anchor.top - PANEL_GAP - height
        const rightOfTrigger = anchor.right + PANEL_GAP
        const leftOfTrigger = anchor.left - PANEL_GAP - width
        if (above >= EDGE_GAP) {
          top = above
          placement = 'above'
        } else if (rightOfTrigger + width <= viewportWidth - EDGE_GAP || leftOfTrigger >= EDGE_GAP) {
          // No room above or below (a tall panel on a short viewport): open beside the trigger so it stays uncovered
          // and clickable, kept inside the viewport vertically. The panel scrolls itself if it is still too tall.
          const toTheRight = rightOfTrigger + width <= viewportWidth - EDGE_GAP
          left = toTheRight ? rightOfTrigger : leftOfTrigger
          placement = toTheRight ? 'right' : 'left'
          top = Math.max(EDGE_GAP, Math.min(anchor.top, viewportHeight - EDGE_GAP - height))
        } else {
          top = Math.max(EDGE_GAP, viewportHeight - EDGE_GAP - height)
        }
      }
      setPosition((current) =>
        current && current.top === top && current.left === left && current.placement === placement
          ? current
          : { top, left, placement },
      )
    }
    function schedule() {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    function onScroll(event: Event) {
      // The panel scrolling its own content does not move the trigger.
      if (panelRef.current?.contains(event.target as Node)) return
      schedule()
    }
    measure()
    window.addEventListener('resize', schedule)
    // Capture: scrolling any ancestor (not only the window) moves the trigger.
    window.addEventListener('scroll', onScroll, true)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', onScroll, true)
      setPosition(null)
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
      data-open={open ? '' : undefined}
      data-placement={open ? position?.placement : undefined}
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
          style={position ? { top: `${position.top}px`, left: `${position.left}px` } : undefined}
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
