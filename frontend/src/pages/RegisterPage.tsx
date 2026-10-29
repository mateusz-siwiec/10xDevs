import { useState } from 'react'
import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import '../styles/page.css'
import { translateError } from '../utils/errors'
import type { ErrorInfo } from '../utils/errors'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(email, password)
      navigate('/')
    } catch (err) {
      setError({ err, key: 'auth.registrationFailed' })
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
        <h1>{t('auth.registerTitle')}</h1>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="register-email">{t('auth.email')}</label>
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
            <label htmlFor="register-password">{t('auth.password')}</label>
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
          {error && <p className="error-text">{translateError(error.err, error.key)}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('auth.registering') : t('auth.register')}
          </button>
        </form>
        <p className="page-switch">
          <Trans i18nKey="auth.haveAccount" components={{ authLink: <Link to="/login" /> }} />
        </p>
      </main>
    </div>
  )
}
