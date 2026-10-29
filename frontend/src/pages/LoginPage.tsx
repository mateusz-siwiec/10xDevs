import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import Topbar from '../components/Topbar'
import '../styles/page.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError({ err, key: 'auth.loginFailed' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Topbar />
      <div className="page-shell">
        <main className="page-card">
          <h1>{t('auth.loginTitle')}</h1>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="login-email">{t('auth.email')}</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <p className="error-text">{translateError(error.err, error.key)}</p>}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </form>
          <p className="page-switch">
            <Trans i18nKey="auth.noAccount" components={{ authLink: <Link to="/register" /> }} />
          </p>
        </main>
      </div>
    </>
  )
}
