import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import '../styles/topbar.css'

export default function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  // Only meaningful on narrow screens, where the panel becomes a left-side drawer.
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  function handleLogout() {
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  if (!user) {
    return (
      <header className="topbar topbar-guest">
        <LanguageSwitcher />
      </header>
    )
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-toggle"
        aria-label={t(menuOpen ? 'nav.closeMenu' : 'nav.menu')}
        aria-expanded={menuOpen}
        aria-controls="topbar-panel"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {menuOpen && <button type="button" className="topbar-backdrop" aria-label={t('nav.closeMenu')} onClick={closeMenu} />}
      <div id="topbar-panel" className={menuOpen ? 'topbar-panel open' : 'topbar-panel'}>
        <nav className="topbar-nav">
          <NavLink to="/" end className="topbar-link" onClick={closeMenu}>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/workout" className="topbar-link" onClick={closeMenu}>
            {t('nav.workout')}
          </NavLink>
          <NavLink to="/history" className="topbar-link" onClick={closeMenu}>
            {t('nav.history')}
          </NavLink>
          <NavLink to="/plans" className="topbar-link" onClick={closeMenu}>
            {t('nav.plans')}
          </NavLink>
          <NavLink to="/exercises" className="topbar-link" onClick={closeMenu}>
            {t('nav.exercises')}
          </NavLink>
        </nav>
        <span className="topbar-user">{user.email}</span>
        <LanguageSwitcher />
        <button type="button" onClick={handleLogout} className="topbar-logout">
          {t('nav.logout')}
        </button>
      </div>
    </header>
  )
}
