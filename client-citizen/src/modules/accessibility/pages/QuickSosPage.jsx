import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react'

import { Spinner } from '@components/ui'
import { useSendSos } from '@hooks'
import { errorMessage, storage } from '@utils'
import { vibrateOutcome } from '../vibration'
import { SosSignalPanel } from '../components/SosSignalPanel'
import '../contrast'

const GUARD_KEY = 'crisis.quickSosAt'
const GUARD_MS = 15000

const VIEW = {
  sending: { cls: 'bg-brand', Icon: null },
  sent: { cls: 'bg-safe', Icon: CheckCircle2 },
  duplicate: { cls: 'bg-safe', Icon: CheckCircle2 },
  queued: { cls: 'bg-warn', Icon: Clock },
  error: { cls: 'bg-sos', Icon: XCircle },
  guarded: { cls: 'bg-safe', Icon: CheckCircle2 },
}

/**
 * Opened by the home-screen shortcut ("SOS göndər"): sends a general SOS
 * immediately with the last known location — no taps needed — then shows a
 * big confirmation and the sound/light signal control.
 */
export const QuickSosPage = () => {
  const { t } = useTranslation()
  const { send } = useSendSos()
  // A shortcut tapped twice in a row must not create two tickets
  const [state, setState] = useState(() => {
    const last = Number(storage.get(GUARD_KEY))
    return Number.isFinite(last) && Date.now() - last < GUARD_MS ? { status: 'guarded' } : { status: 'sending' }
  })
  const started = useRef(false)

  const fire = async ({ initial = false } = {}) => {
    if (!initial) setState({ status: 'sending' })
    storage.set(GUARD_KEY, String(Date.now()))
    const res = await send('general', { note: 'quick_shortcut' })
    if (res.status === 'busy') return
    vibrateOutcome(res.status === 'error' ? 'error' : res.status)
    setState(res)
  }

  useEffect(() => {
    if (started.current || state.status !== 'sending') return
    started.current = true
    fire({ initial: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const view = VIEW[state.status] ?? VIEW.sending
  const title =
    state.status === 'sending'
      ? t('a11y.quick.sending')
      : state.status === 'guarded'
        ? t('a11y.quick.sent')
        : t(`a11y.quick.${state.status}`)

  return (
    <main id="main" className="flex min-h-full flex-col gap-4 bg-canvas p-4">
      <h1 className="sr-only">{t('a11y.quick.title')}</h1>
      <section
        role="status"
        aria-live="assertive"
        className={clsx('flex min-h-[45vh] flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center text-white', view.cls)}
      >
        {view.Icon ? <view.Icon className="h-24 w-24" aria-hidden /> : <Spinner className="h-20 w-20 border-[6px]" label={title} />}
        <p className="text-3xl font-extrabold leading-tight">{title}</p>
        {state.status === 'guarded' && <p className="text-base font-semibold">{t('a11y.quick.alreadySent')}</p>}
        {state.status === 'error' && <p className="text-base font-semibold">{errorMessage(state.error)}</p>}
        {['sent', 'duplicate', 'queued'].includes(state.status) && (
          <p className="text-base font-semibold">{state.approx ? t('a11y.quick.approx') : t('a11y.quick.located')}</p>
        )}
      </section>

      {state.status === 'error' && (
        <button
          type="button"
          onClick={fire}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-sos text-lg font-extrabold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sos focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-6 w-6" aria-hidden />
          {t('a11y.quick.retry')}
        </button>
      )}

      <SosSignalPanel compact />

      <Link
        to="/"
        className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-line-strong bg-surface text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand"
      >
        {t('a11y.quick.openApp')}
      </Link>
    </main>
  )
}
