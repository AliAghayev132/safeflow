import { useCallback, useEffect, useRef, useState } from 'react'
import { storage } from '@utils/deviceId'
import { SosSignalPlayer } from './morse'

const PREFS_KEY = 'crisis.signalPrefs'
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const loadPrefs = () => {
  try {
    const p = JSON.parse(storage.get(PREFS_KEY) ?? 'null')
    if (p) return { flash: Boolean(p.flash), torch: Boolean(p.torch) }
  } catch {
    // ignore
  }
  // Flashing defaults off for users who asked the OS to reduce motion
  return { flash: !reducedMotion(), torch: false }
}

/**
 * SOS signal (sound + optional screen flash + optional torch) in the Morse
 * SOS rhythm, repeating until stopped. Preferences are persisted.
 */
export const useSosSignal = () => {
  const [prefs, setPrefsState] = useState(loadPrefs)
  const [active, setActive] = useState(false)
  const [lit, setLit] = useState(false)
  const [torchState, setTorchState] = useState('off')
  const [soundOk, setSoundOk] = useState(true)
  const player = useRef(null)

  const setPrefs = useCallback((patch) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch }
      storage.set(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const stop = useCallback(() => {
    player.current?.stop()
    player.current = null
    setActive(false)
    setLit(false)
  }, [])

  const start = useCallback(async () => {
    if (player.current) return
    const p = new SosSignalPlayer({ onChange: setLit })
    player.current = p
    setActive(true)
    const res = await p.start({ sound: true, torch: prefs.torch })
    setTorchState(res.torch)
    setSoundOk(res.sound)
  }, [prefs.torch])

  // Escape stops the signal (keyboard users); cleanup on unmount
  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => e.key === 'Escape' && stop()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, stop])

  useEffect(() => () => player.current?.stop(), [])

  return { active, lit, start, stop, prefs, setPrefs, torchState, soundOk }
}
