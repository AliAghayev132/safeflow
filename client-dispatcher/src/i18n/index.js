import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import az from './locales/az'
import en from './locales/en'
import ru from './locales/ru'

const STORAGE_KEY = 'dispatcher.lang'

export const LANGUAGES = [
  { code: 'az', label: 'AZ', locale: 'az-AZ' },
  { code: 'en', label: 'EN', locale: 'en-GB' },
  { code: 'ru', label: 'RU', locale: 'ru-RU' },
]

const readLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return LANGUAGES.some((l) => l.code === saved) ? saved : 'az'
  } catch {
    return 'az'
  }
}

i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, en: { translation: en }, ru: { translation: ru } },
  lng: readLang(),
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // storage unavailable — choice lives for this tab only
  }
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

/** Intl locale for the active language. */
export const currentLocale = () =>
  LANGUAGES.find((l) => l.code === i18n.language)?.locale ?? 'az-AZ'

export default i18n
