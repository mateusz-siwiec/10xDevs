import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/page.css'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-shell">
      <div className="language-switcher-floating">
        <LanguageSwitcher />
      </div>
      <main className="page-card">
        <h1>Register</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Registering…' : 'Register'}
          </button>
        </form>
        <p className="page-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </main>
    </div>
  )
}
