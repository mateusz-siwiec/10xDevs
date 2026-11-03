import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent, PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { exerciseName, exerciseTechnique } from '../utils/exercises'

interface TechniqueTooltipProps {
  exercise: { slug: string; name: string }
}

/** Minimum gap kept between the panel and the viewport edge, in px (1rem at the default font size). */
const EDGE_GAP = 16

/**
 * Info button that reveals the form cues for an exercise. Opens on hover and keyboard focus, toggles on tap/click;
 * closes on Escape (focus returns to the button), outside mousedown or focus leaving. Renders nothing for exercises
 * without technique content.
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
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Keep the panel inside the viewport: measure it unshifted, then nudge it back by the overflow.
  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    panel.style.left = '0px'
    const rect = panel.getBoundingClientRect()
    const viewport = document.documentElement.clientWidth
    let next = 0
    if (rect.right > viewport - EDGE_GAP) next = viewport - EDGE_GAP - rect.right
    if (rect.left + next < EDGE_GAP) next = EDGE_GAP - rect.left
    panel.style.left = ''
    setShift(next)
  }, [open])

  const cues = exerciseTechnique(exercise)
  if (!cues) return null

  function onFocus(event: FocusEvent) {
    // Only keyboard focus opens it; a tap or click also focuses the button and then toggles via onClick.
    if ((event.target as HTMLElement).matches(':focus-visible')) setOpen(true)
  }

  function onBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null
    if (next && rootRef.current && !rootRef.current.contains(next)) setOpen(false)
  }

  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType !== 'touch') setOpen(true)
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'touch') return
    const active = document.activeElement
    const keyboardInside = active && rootRef.current?.contains(active) && active.matches(':focus-visible')
    if (!keyboardInside) setOpen(false)
  }

  function onClick() {
    // A mouse click lands while hover already opened it; keep it open. Touch and keyboard toggle.
    if (pointerType.current === 'mouse') setOpen(true)
    else setOpen((value) => !value)
    pointerType.current = ''
  }

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
        aria-label={t('exercises.techniqueLabel', { name: exerciseName(exercise) })}
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
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="tooltip"
          className="technique-panel"
          style={shift ? { left: `${shift}px` } : undefined}
        >
          <p className="technique-heading">{t('exercises.techniqueHeading')}</p>
          <ul className="technique-list">
            {cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        </div>
      )}
    </span>
  )
}
