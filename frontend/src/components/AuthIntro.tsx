import { useTranslation } from 'react-i18next'

/** Brand header (logo, name, tagline) shown above the login/register card. */
export function AuthIntro() {
  const { t } = useTranslation()
  return (
    <header className="auth-intro">
      <img src="/favicon.svg" alt="" width="56" height="56" className="auth-logo" />
      <p className="auth-brand">GymTrack</p>
      <p className="auth-tagline">{t('auth.tagline')}</p>
    </header>
  )
}

/** Short feature list shown below the login/register card. */
export function AuthFeatures() {
  const { t } = useTranslation()
  const keys = ['logSets', 'progress', 'plans', 'suggestions'] as const
  return (
    <ul className="auth-features">
      {keys.map((key) => (
        <li key={key}>{t(`auth.features.${key}`)}</li>
      ))}
    </ul>
  )
}
