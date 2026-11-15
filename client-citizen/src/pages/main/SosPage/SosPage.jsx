import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { clsx } from 'clsx'

import {
  LocationHeader,
  SosButton,
  SosTypeGrid,
  SafeShareButton,
  HelpRequested,
  FollowUpForm,
  VoiceSosButton,
  GuideSteps,
} from '@components'
import { useSendSos } from '@hooks'
import { selectActiveTicket } from '@store/slices'
import { guideForSosType } from '@constants'
import { errorMessage } from '@utils'

const FEEDBACK_TONE = {
  sent: 'bg-safe text-white',
  duplicate: 'bg-safe text-white',
  queued: 'bg-warn text-white',
  error: 'bg-sos-soft text-sos',
}

/**
 * Start screen — always the SOS screen. No login, no extra steps:
 * one tap on SOS or a hazard type sends immediately; "I'm safe" is here too.
 */
export const SosPage = () => {
  const { t } = useTranslation()
  const ticket = useSelector(selectActiveTicket)
  const { send, sendingType } = useSendSos()
  const [feedback, setFeedback] = useState(null)

  const handleSend = async (type, details) => {
    setFeedback(null)
    const res = await send(type, details)
    if (res.status === 'busy') return
    navigator.vibrate?.(200)
    setFeedback({
      status: res.status,
      text:
        res.status === 'error'
          ? errorMessage(res.error)
          : t(res.status === 'queued' ? 'sos.queued' : res.status === 'duplicate' ? 'sos.duplicate' : 'sos.sent'),
    })
  }

  const live = ticket && !['resolved', 'cancelled'].includes(ticket.status)

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <LocationHeader />

      {feedback && (
        <div role="status" className={clsx('animate-slide-down rounded-2xl px-4 py-3 text-sm font-bold', FEEDBACK_TONE[feedback.status])}>
          {feedback.text}
        </div>
      )}

      {ticket ? (
        <>
          <HelpRequested ticket={ticket} />
          {live && <VoiceSosButton onSend={handleSend} />}
          {live && <FollowUpForm key={ticket.clientId} ticket={ticket} />}
          <section className="rounded-3xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-base font-extrabold text-ink">{t('guide.title')}</h2>
            <GuideBlock type={ticket.type} />
          </section>
        </>
      ) : (
        <>
          <section className="rounded-3xl border border-line bg-surface px-4 pb-4 pt-5">
            <h1 className="text-2xl font-extrabold leading-tight text-ink">{t('sos.question')}</h1>
            <p className="mt-1.5 text-sm font-medium text-ink-soft">{t('sos.intro')}</p>
            <SosButton onPress={() => handleSend('general')} sending={sendingType === 'general'} disabled={Boolean(sendingType)} />
          </section>

          <SosTypeGrid onSend={handleSend} sendingType={sendingType} />
          <VoiceSosButton onSend={handleSend} />
        </>
      )}

      <SafeShareButton />
    </div>
  )
}

/** Guide auto-selected from the active SOS type, still browsable. */
const GuideBlock = ({ type }) => {
  const [value, setValue] = useState(guideForSosType[type] ?? 'earthquake')
  return <GuideSteps value={value} onChange={setValue} highlight={value === (guideForSosType[type] ?? 'earthquake')} />
}
