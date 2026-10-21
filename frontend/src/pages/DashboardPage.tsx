import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <main style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', textAlign: 'left' }}>
      <h1>Dashboard</h1>
      <p>Logged in as {user?.email}</p>
      <button
        type="button"
        onClick={handleLogout}
        style={{ minHeight: '44px', padding: '0.75rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}
      >
        Log out
      </button>
    </main>
  )
}
