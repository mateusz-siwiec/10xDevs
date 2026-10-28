import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'
import '../styles/topbar.css'

export default function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  if (!user) {
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <nav className="topbar-nav">
        <NavLink to="/" end className="topbar-link">
          {t('nav.dashboard')}
        </NavLink>
        <NavLink to="/workout" className="topbar-link">
          {t('nav.workout')}
        </NavLink>
        <NavLink to="/history" className="topbar-link">
          {t('nav.history')}
        </NavLink>
        <NavLink to="/plans" className="topbar-link">
          {t('nav.plans')}
        </NavLink>
        <NavLink to="/exercises" className="topbar-link">
          {t('nav.exercises')}
        </NavLink>
      </nav>
      <span className="topbar-user">{user.email}</span>
      <LanguageSwitcher />
      <button type="button" onClick={handleLogout} className="topbar-logout">
        {t('nav.logout')}
      </button>
    </header>
  )
}
