import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Square, Volume2 } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { useSosSignal } from '../useSosSignal'

/**
 * Full-screen white/red flash in the Morse SOS rhythm. One large stop button
 * (focused on open, Escape also stops). Rendered only while signalling.
 */
const FlashOverlay = ({ lit, onStop }) => {
  const { t } = useTranslation()
  const stopRef = useRef(null)

  useEffect(() => {
    stopRef.current?.focus()
  }, [])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={t('a11y.signal.overlayLabel')}
      className={clsx('fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-8 p-6', lit ? 'bg-white' : 'bg-sos')}
    >
      <p className={clsx('text-7xl font-extrabold tracking-widest', lit ? 'text-sos' : 'text-white')} aria-hidden>
        SOS
      </p>
      <button
        ref={stopRef}
        type="button"
        onClick={onStop}
        className="flex min-h-20 w-full max-w-sm items-center justify-center gap-3 rounded-3xl border-4 border-ink bg-ink px-6 text-xl font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-ink"
      >
        <Square className="h-6 w-6" aria-hidden fill="currentColor" />
        {t('a11y.signal.stop')}
      </button>
    </div>
  )
}

const Toggle = ({ id, checked, onChange, label, hint }) => (
  <div className="flex items-start gap-3">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-brand)]"
      aria-describedby={hint ? `${id}-hint` : undefined}
    />
    <label htmlFor={id} className="min-h-12 flex-1 cursor-pointer">
      <span className="block text-sm font-bold text-ink">{label}</span>
      {hint && (
        <span id={`${id}-hint`} className="block text-xs font-medium text-muted">
          {hint}
        </span>
      )}
    </label>
  </div>
)

/**
 * "I can't speak — sound signal": loud Morse SOS whistle + flashing screen +
 * torch (where the device allows it), repeating until stopped. For people
 * trapped under rubble who cannot call out.
 */
export const SosSignalPanel = ({ compact = false }) => {
  const { t } = useTranslation()
  const { active, lit, start, stop, prefs, setPrefs, torchState, soundOk } = useSosSignal()

  return (
    <section
      aria-labelledby="sos-signal-title"
      className={clsx('rounded-3xl border-2 bg-surface p-4', active ? 'border-sos' : 'border-line')}
    >
      <div className="flex items-start gap-3">
        <Icon3D name="megaphone" size={40} />
        <div className="min-w-0 flex-1">
          <h2 id="sos-signal-title" className="text-base font-extrabold text-ink">
            {t('a11y.signal.title')}
          </h2>
          {!compact && <p className="mt-0.5 text-sm text-ink-soft">{t('a11y.signal.desc')}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={active ? stop : start}
        aria-pressed={active}
        className={clsx(
          'mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-4 text-lg font-extrabold transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
          active
            ? 'bg-ink text-white hover:bg-ink-soft focus-visible:ring-ink'
            : 'bg-sos text-white hover:bg-sos-hover focus-visible:ring-sos'
        )}
      >
        {active ? <Square className="h-6 w-6" aria-hidden fill="currentColor" /> : <Volume2 className="h-6 w-6" aria-hidden />}
        {active ? t('a11y.signal.stop') : t('a11y.signal.start')}
      </button>

      <div aria-live="polite" className="mt-2 space-y-1 text-xs font-semibold">
        {active && <p className="text-sos">{t('a11y.signal.active')} — {t('a11y.signal.activeHint')}</p>}
        {active && !soundOk && <p className="text-warn">{t('a11y.signal.soundBlocked')}</p>}
        {prefs.torch && torchState === 'unsupported' && <p className="text-warn">{t('a11y.signal.torchUnsupported')}</p>}
        {prefs.torch && torchState === 'denied' && <p className="text-warn">{t('a11y.signal.torchDenied')}</p>}
      </div>

      {!active && (
        <div className="mt-3 space-y-2">
          <Toggle
            id="sos-flash"
            checked={prefs.flash}
            onChange={(v) => setPrefs({ flash: v })}
            label={t('a11y.signal.flash')}
            hint={t('a11y.signal.flashWarning')}
          />
          <Toggle
            id="sos-torch"
            checked={prefs.torch}
            onChange={(v) => setPrefs({ torch: v })}
            label={t('a11y.signal.torch')}
            hint={t('a11y.signal.torchHint')}
          />
        </div>
      )}

      {active && prefs.flash && <FlashOverlay lit={lit} onStop={stop} />}
    </section>
  )
}
