import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'
import '../styles/language-switcher.css'

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="language-switcher" role="group" aria-label={t('common.language')}>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          className="language-switcher-btn"
          aria-pressed={current === lng}
          onClick={() => void i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
