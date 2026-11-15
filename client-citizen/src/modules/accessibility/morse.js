/**
 * SOS in Morse code: ··· ––– ···  (dot = 1 unit, dash = 3, gap inside a
 * letter = 1, between letters = 3, between repetitions = 7).
 *
 * UNIT_MS = 200 → the fastest on/off cycle is 2.5 Hz, below the WCAG 2.3.1
 * "three flashes per second" threshold, so the visual signal stays within
 * the photosensitivity guideline.
 */
export const UNIT_MS = 200

const LETTERS = [
  [1, 1, 1], // S
  [3, 3, 3], // O
  [1, 1, 1], // S
]

/** One repetition as on/off steps: [{ on: boolean, ms: number }] */
export const SOS_TIMELINE = LETTERS.flatMap((letter, li) => [
  ...letter.flatMap((units, i) => [
    { on: true, ms: units * UNIT_MS },
    ...(i < letter.length - 1 ? [{ on: false, ms: UNIT_MS }] : []),
  ]),
  { on: false, ms: (li < LETTERS.length - 1 ? 3 : 7) * UNIT_MS },
])

export const SOS_CYCLE_MS = SOS_TIMELINE.reduce((sum, s) => sum + s.ms, 0)

/** Feature-detect a controllable torch (asks for camera permission). */
export const openTorch = async () => {
  if (!navigator.mediaDevices?.getUserMedia) return { state: 'unsupported' }
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
  } catch (error) {
    return { state: error?.name === 'NotAllowedError' ? 'denied' : 'unsupported' }
  }
  const track = stream.getVideoTracks()[0]
  const caps = track?.getCapabilities?.() ?? {}
  if (!caps.torch) {
    stream.getTracks().forEach((t) => t.stop())
    return { state: 'unsupported' }
  }
  return { state: 'on', track, stream }
}

/**
 * Plays the SOS rhythm until stop(): a loud whistle-like tone (WebAudio
 * square wave ~2.6 kHz — carries well through rubble), optional torch, and an
 * onChange(on) callback per step for the screen flash.
 */
export class SosSignalPlayer {
  constructor({ onChange } = {}) {
    this.onChange = onChange
    this.running = false
    this.timer = null
  }

  async start({ sound = true, torch = false } = {}) {
    if (this.running) return { torch: this.torchState ?? 'off', sound: this.soundOk }
    this.running = true
    this.soundOk = false
    if (sound) {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        this.ctx = new Ctx()
        await this.ctx.resume()
        this.osc = this.ctx.createOscillator()
        this.osc.type = 'square'
        this.osc.frequency.value = 2600
        this.gain = this.ctx.createGain()
        this.gain.gain.value = 0
        this.osc.connect(this.gain).connect(this.ctx.destination)
        this.osc.start()
        this.soundOk = this.ctx.state === 'running'
      } catch {
        this.soundOk = false
      }
    }
    this.torchState = 'off'
    if (torch) {
      const res = await openTorch()
      this.torchState = res.state
      this.track = res.track
      this.stream = res.stream
    }
    // Keep the screen on while signalling
    try {
      this.wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      this.wakeLock = null
    }
    if (this.running) this.#step(0)
    return { torch: this.torchState, sound: this.soundOk }
  }

  #set(on) {
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.004)
    }
    this.track?.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {})
    this.onChange?.(on)
  }

  #step(i) {
    if (!this.running) return
    const step = SOS_TIMELINE[i % SOS_TIMELINE.length]
    this.#set(step.on)
    this.timer = setTimeout(() => this.#step(i + 1), step.ms)
  }

  stop() {
    this.running = false
    clearTimeout(this.timer)
    this.#set(false)
    try {
      this.osc?.stop()
      this.ctx?.close()
    } catch {
      // already stopped
    }
    this.stream?.getTracks().forEach((t) => t.stop())
    this.wakeLock?.release?.().catch(() => {})
    this.ctx = this.osc = this.gain = this.track = this.stream = this.wakeLock = null
  }
}
