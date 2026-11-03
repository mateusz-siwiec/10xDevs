import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'

interface ExercisesMenuProps {
  /** Called after a menu item is chosen, so the mobile drawer can close. */
  onNavigate: () => void
}

const NARROW = '(max-width: 768px)'

/**
 * "Exercises" entry of the top bar: a disclosure button that opens the exercise pages (the list and the add form). On desktop it is a
 * popover (closes on Escape, outside click or choosing an item); in the narrow-screen drawer the same list is an
 * inline expandable group, so outside clicks never collapse it.
 */
export default function ExercisesMenu({ onNavigate }: ExercisesMenuProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const onExercises = pathname.startsWith('/exercises')
  // On a phone, opening the drawer on an exercises page shows the group already expanded.
  const [open, setOpen] = useState(() => onExercises && window.matchMedia(NARROW).matches)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (window.matchMedia(NARROW).matches) return
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
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
      setTimeout(() => focusAt(delta === 1 ? 0 : -1), 0)
      return
    }
    const current = links().indexOf(document.activeElement as HTMLAnchorElement)
    focusAt(current === -1 ? (delta === 1 ? 0 : -1) : current + delta)
  }

  function choose() {
    setOpen(false)
    onNavigate()
  }

  const items = [
    { to: '/exercises', label: t('nav.exercises'), active: pathname === '/exercises' },
    { to: '/exercises/new', label: t('nav.newExercise'), active: pathname === '/exercises/new' },
  ]

  return (
    <div className="topbar-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={buttonRef}
        className={onExercises ? 'topbar-link topbar-menu-button active' : 'topbar-link topbar-menu-button'}
        aria-expanded={open}
        aria-controls="topbar-exercises-menu"
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
