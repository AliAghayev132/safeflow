import { useCallback, useState } from 'react'

const ERROR_KEYS = { 1: 'denied', 2: 'unavailable', 3: 'timeout' }

/**
 * One-shot browser geolocation. `locate({ timeout })` resolves with
 * { lat, lng } or null; `errorKey` is a translation key suffix
 * (evacuation.geo.<key>).
 */
export const useGeolocation = () => {
  const [loading, setLoading] = useState(false)
  const [errorKey, setErrorKey] = useState(null)

  const locate = useCallback(
    ({ timeout = 10000, silent = false } = {}) =>
      new Promise((resolve) => {
        if (!('geolocation' in navigator)) {
          if (!silent) setErrorKey('unsupported')
          resolve(null)
          return
        }
        if (!silent) setLoading(true)
        setErrorKey(null)
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLoading(false)
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          },
          (err) => {
            setLoading(false)
            if (!silent) setErrorKey(ERROR_KEYS[err.code] ?? 'unavailable')
            resolve(null)
          },
          { enableHighAccuracy: true, timeout, maximumAge: 60000 }
        )
      }),
    []
  )

  return { locate, loading, errorKey, setErrorKey }
}
