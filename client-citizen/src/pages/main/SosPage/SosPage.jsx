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
  PriorityRoleBadge,
} from '@components'
import { useSendSos } from '@hooks'
import { SosSignalPanel, vibrateOutcome } from '@/modules/accessibility'
import { AssistantEntryCard } from '@/modules/assistant'
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
    // Distinct pattern per outcome — clear without looking at the screen
    vibrateOutcome(res.status)
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
    <div className="stagger space-y-5">
      <LocationHeader />
      <PriorityRoleBadge compact />

      {/* Always-mounted live region so screen readers announce the outcome */}
      <div role="status" aria-live="assertive" aria-atomic="true">
        {feedback && (
          <div
            className={clsx(
              'animate-slide-down flex items-center gap-3 rounded-3xl px-5 py-4 text-sm font-bold',
              FEEDBACK_TONE[feedback.status]
            )}
          >
            {(feedback.status === 'sent' || feedback.status === 'duplicate') && <SuccessCheck />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {ticket ? (
        <>
          <HelpRequested ticket={ticket} />
          {live && <SosSignalPanel compact />}
          {live && <VoiceSosButton onSend={handleSend} />}
          {live && <FollowUpForm key={ticket.clientId} ticket={ticket} />}
          <section className="rounded-3xl bg-surface p-4">
            <h2 className="mb-3 text-base font-extrabold text-ink">{t('guide.title')}</h2>
            <GuideBlock type={ticket.type} />
          </section>
        </>
      ) : (
        <>
          <section className="px-1 pt-2">
            <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink">{t('sos.question')}</h1>
            <p className="mt-2 text-sm font-medium text-muted">{t('sos.intro')}</p>
            <SosButton onPress={() => handleSend('general')} sending={sendingType === 'general'} disabled={Boolean(sendingType)} />
          </section>

          <SosTypeGrid onSend={handleSend} sendingType={sendingType} />
          <SosSignalPanel />
          <VoiceSosButton onSend={handleSend} />
        </>
      )}

      <AssistantEntryCard />
      <SafeShareButton />
    </div>
  )
}

/** Guide auto-selected from the active SOS type, still browsable. */
const GuideBlock = ({ type }) => {
  const [value, setValue] = useState(guideForSosType[type] ?? 'earthquake')
  return <GuideSteps value={value} onChange={setValue} highlight={value === (guideForSosType[type] ?? 'earthquake')} />
}

/** Animated check (solid circle + drawn tick) shown after an SOS is sent. */
const SuccessCheck = () => (
  <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
    <circle cx="16" cy="16" r="16" className="check-circle fill-white" style={{ transformOrigin: 'center' }} />
    <path
      d="M9.5 16.5l4.5 4.5 8.5-9"
      fill="none"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="check-draw stroke-safe"
    />
  </svg>
)
