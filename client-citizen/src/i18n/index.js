import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import az from './locales/az'
import en from './locales/en'
import ru from './locales/ru'
import { storage } from '@utils/deviceId'

export const LANGUAGES = ['az', 'en', 'ru']
const STORAGE_KEY = 'crisis.lang'

const saved = storage.get(STORAGE_KEY)
const initial = LANGUAGES.includes(saved) ? saved : 'az'

i18n.use(initReactI18next).init({
  resources: { az: { translation: az }, en: { translation: en }, ru: { translation: ru } },
  lng: initial,
  fallbackLng: 'az',
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = initial

/** Change UI language and persist the choice. */
export const setLanguage = (lng) => {
  if (!LANGUAGES.includes(lng)) return
  i18n.changeLanguage(lng)
  storage.set(STORAGE_KEY, lng)
  document.documentElement.lang = lng
}

/** BCP-47 tags for dates and the Web Speech API. */
export const LOCALE_TAGS = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU' }

export default i18n
