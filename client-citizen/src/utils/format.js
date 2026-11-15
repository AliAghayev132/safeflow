import i18n, { LOCALE_TAGS } from '@/i18n'

const t = (...args) => i18n.t(...args)
const locale = () => LOCALE_TAGS[i18n.language] ?? 'az-AZ'

/** 850 m · 2.4 km */
export const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return '—'
  if (meters < 1000) return t('units.m', { value: Math.round(meters) })
  return t('units.km', { value: (meters / 1000).toFixed(1) })
}

/** 12 dəq · 1 saat 05 dəq */
export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return '—'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return t('units.min', { value: minutes })
  return t('units.hourMin', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') })
}

/** Elapsed time since a timestamp: "45 san", "3 dəq", "1 saat 05 dəq" */
export const formatElapsed = (from, now = Date.now()) => {
  const sec = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  if (sec < 60) return t('time.seconds', { n: sec })
  const min = Math.floor(sec / 60)
  if (min < 60) return t('time.minutes', { n: min })
  return t('time.hours', { n: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') })
}

/** 14:05 */
export const formatTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
}

/** 15.11.2026 14:05 */
export const formatDateTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatPercent = (rate) => `${Math.round((rate ?? 0) * 100)}%`

/** Translated message for an API error ({ code, message, retryAfter }). */
export const errorMessage = (error) => {
  if (!error) return ''
  const code = error.code ?? (error.status === 'FETCH_ERROR' ? 'FETCH_ERROR' : null)
  if (code) {
    return t(`errors.${code}`, { sec: error.retryAfter ?? 60, defaultValue: error.message ?? t('errors.generic') })
  }
  return error.message ?? t('errors.generic')
}
