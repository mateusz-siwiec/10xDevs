import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import pl from './locales/pl.json'

export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'gymtrack.lang'

function isSupported(value: unknown): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
}

function detectLanguage(): SupportedLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isSupported(stored)) return stored
  } catch {
    // localStorage can throw (private windows, blocked site data); fall through to navigator.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return nav?.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, pl: { translation: pl } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  initAsync: false,
})

function applyLanguage(lng: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Ignore: persistence is a convenience.
  }
}

i18n.on('languageChanged', applyLanguage)
applyLanguage(i18n.language)

export default i18n
