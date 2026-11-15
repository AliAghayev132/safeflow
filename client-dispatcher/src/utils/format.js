import i18n, { currentLocale } from '@/i18n'

const t = (...args) => i18n.t(...args)

export const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString(currentLocale(), {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '—'

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString(currentLocale(), {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '—'

export const formatNumber = (value) => new Intl.NumberFormat(currentLocale()).format(value ?? 0)

export const formatPercent = (rate, digits = 0) => `${((rate ?? 0) * 100).toFixed(digits)}%`

/** "3 min ago" style relative time. `now` is passed in so callers can tick. */
export const formatAgo = (value, now = Date.now()) => {
  if (!value) return '—'
  const sec = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
  if (sec < 10) return t('time.justNow')
  if (sec < 60) return t('time.secondsAgo', { count: sec })
  const min = Math.floor(sec / 60)
  if (min < 60) return t('time.minutesAgo', { count: min })
  return t('time.hoursAgo', { count: Math.floor(min / 60) })
}

export const shortId = (id) => (id ? id.slice(-6).toUpperCase() : '—')

/** Translated title / message for an alert (server sends i18n keys + params). */
export const alertText = (alert, zonesById = {}) => {
  const params = { ...(alert.i18n?.params ?? {}) }
  if (params.hazard) params.hazard = t(`sosType.${params.hazard}`)
  if (!params.zone) params.zone = zonesById[alert.zone]?.name ?? t('alert.unknownZone')
  return {
    title: alert.i18n?.titleKey ? t(alert.i18n.titleKey, params) : alert.title,
    message: alert.i18n?.messageKey ? t(alert.i18n.messageKey, params) : alert.message,
  }
}

/**
 * Translated message for an RTK Query error from baseApi
 * ({ status, data: { code, message }, retryAfter }).
 */
export const errorText = (error, fallbackKey = 'errors.GENERIC') => {
  if (!error) return t(fallbackKey)
  if (error.status === 'FETCH_ERROR') return t('errors.NETWORK')
  const code = error.data?.code
  const serverMessage = error.data?.message
  if (code === 'RATE_LIMITED') {
    return t('errors.RATE_LIMITED', { seconds: error.retryAfter ?? error.data?.limit?.retryAfterSec ?? 60 })
  }
  // Generic codes carry a specific server message (e.g. config validation)
  if (['BAD_REQUEST', 'CONFLICT', 'NOT_FOUND', 'ERROR'].includes(code) && serverMessage) {
    return `${t(`errors.${code}`, { defaultValue: t(fallbackKey) })} — ${serverMessage}`
  }
  if (code && i18n.exists(`errors.${code}`)) return t(`errors.${code}`)
  return serverMessage ?? t(fallbackKey)
}
