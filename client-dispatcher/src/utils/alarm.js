// Short two-tone alarm generated with WebAudio (no audio files).
let ctx = null

const getContext = () => {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!ctx) ctx = new AudioCtx()
  return ctx
}

/** Call from a user gesture (e.g. login click) so later alarms may play. */
export const unlockAudio = () => {
  const audio = getContext()
  if (audio?.state === 'suspended') audio.resume().catch(() => {})
}

export const playAlarm = () => {
  const audio = getContext()
  if (!audio || audio.state !== 'running') return

  const start = audio.currentTime
  const tones = [880, 660, 880, 660]
  tones.forEach((freq, i) => {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    const t = start + i * 0.16
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  })
}
