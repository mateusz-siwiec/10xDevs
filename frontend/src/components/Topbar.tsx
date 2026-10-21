import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import '../styles/topbar.css'

export default function Topbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="topbar">
      <span className="topbar-user">{user.email}</span>
      <button type="button" onClick={handleLogout} className="topbar-logout">
        Log out
      </button>
    </header>
  )
}
