import { useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'

interface ExercisesMenuProps {
  /** Called after a menu item is chosen, so the mobile drawer can close. */
  onNavigate: () => void
}

const NARROW = '(max-width: 768px)'
const isNarrow = () => window.matchMedia(NARROW).matches

/**
 * "Exercises" entry of the top bar: a disclosure button that opens the exercise pages (the list and the add form).
 * On desktop it is a popover (closes on Escape, outside click, focus leaving it, or choosing an item); in the
 * narrow-screen drawer the same list is an inline expandable group that the drawer, not this menu, closes.
 */
export default function ExercisesMenu({ onNavigate }: ExercisesMenuProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const onExercises = pathname.startsWith('/exercises')
  // On a phone, opening the drawer on an exercises page shows the group already expanded.
  const [open, setOpen] = useState(() => onExercises && isNarrow())
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Read inside the media-query listener, which is registered once.
  const onExercisesRef = useRef(onExercises)
  useEffect(() => {
    onExercisesRef.current = onExercises
  }, [onExercises])

  // Crossing the phone breakpoint switches between "popover" and "expanded group" behaviour.
  useEffect(() => {
    const query = window.matchMedia(NARROW)
    function onChange() {
      setOpen(query.matches && onExercisesRef.current)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => () => clearTimeout(focusTimer.current), [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (isNarrow()) return
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      // On a phone Escape closes the whole drawer (see Topbar), which also returns focus to its toggle.
      if (event.key !== 'Escape' || isNarrow()) return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function links(): HTMLAnchorElement[] {
    return Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>('.topbar-submenu a') ?? [])
  }

  function focusAt(index: number) {
    const items = links()
    if (items.length > 0) items[(index + items.length) % items.length].focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const delta = event.key === 'ArrowDown' ? 1 : -1
    if (!open) {
      setOpen(true)
      // The list mounts on the next render; focus the first (or last) item then.
      focusTimer.current = setTimeout(() => focusAt(delta === 1 ? 0 : -1), 0)
      return
    }
    const current = links().indexOf(document.activeElement as HTMLAnchorElement)
    focusAt(current === -1 ? (delta === 1 ? 0 : -1) : current + delta)
  }

  // Tabbing out of the popover closes it; the drawer group stays open.
  function onBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null
    if (open && !isNarrow() && next && rootRef.current && !rootRef.current.contains(next)) setOpen(false)
  }

  function choose() {
    // Keep focus on something that survives the list unmounting (the button is hidden on a phone, where the
    // drawer's own close handler takes over).
    buttonRef.current?.focus()
    // On a phone the group stays expanded, so reopening the drawer on an exercises page still shows it open.
    if (!isNarrow()) setOpen(false)
    onNavigate()
  }

  const items = [
    { to: '/exercises', label: t('nav.exercises'), active: pathname === '/exercises' },
    { to: '/exercises/new', label: t('nav.newExercise'), active: pathname === '/exercises/new' },
  ]

  return (
    <div className="topbar-menu" ref={rootRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        type="button"
        ref={buttonRef}
        className={onExercises ? 'topbar-link topbar-menu-button active' : 'topbar-link topbar-menu-button'}
        aria-expanded={open}
        aria-controls={open ? 'topbar-exercises-menu' : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {t('nav.exercises')}
        <svg
          className={open ? 'topbar-menu-caret open' : 'topbar-menu-caret'}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul id="topbar-exercises-menu" className="topbar-submenu">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={item.active ? 'topbar-submenu-link active' : 'topbar-submenu-link'}
                aria-current={item.active ? 'page' : undefined}
                onClick={choose}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
