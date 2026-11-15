import { storage } from '@utils/deviceId'

const KEY = 'crisis.contrast'

/**
 * High-contrast mode. `auto` follows `prefers-contrast: more`; `on`/`off` is
 * the user's explicit choice (persisted). Applied as a class on <html>:
 *   .hc      → forced on
 *   .hc-off  → forced off (overrides the media query)
 */
export const readContrast = () => {
  const v = storage.get(KEY)
  return v === 'on' || v === 'off' ? v : 'auto'
}

export const applyContrast = (mode = readContrast()) => {
  const root = document.documentElement
  root.classList.toggle('hc', mode === 'on')
  root.classList.toggle('hc-off', mode === 'off')
}

/** Effective state (explicit choice, else the OS preference). */
export const isHighContrast = (mode = readContrast()) =>
  mode === 'on' || (mode === 'auto' && window.matchMedia?.('(prefers-contrast: more)').matches)

export const setContrast = (mode) => {
  storage.set(KEY, mode)
  applyContrast(mode)
}

// Apply as early as possible (module is imported by the app shell)
applyContrast()
