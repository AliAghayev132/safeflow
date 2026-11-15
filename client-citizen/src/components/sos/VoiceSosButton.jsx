import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { Mic, Square } from 'lucide-react'

import { useSpeech } from '@hooks'
import { useUpdateSosDetailsMutation } from '@store/api'
import { selectActiveTicket, selectDeviceId, detailsSaved, mergeQueuedDetails } from '@store/slices'
import { LOCALE_TAGS } from '@/i18n'
import { parseTranscript } from '@utils'

/**
 * Voice SOS for people who can't type (trapped, injured). The transcript is
 * parsed for hazard type, needs and head-count:
 *   - no live ticket → a new SOS is sent automatically with the transcript
 *   - live ticket    → the transcript is attached to it
 * Hidden when the browser has no speech recognition.
 */
export const VoiceSosButton = ({ onSend }) => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const deviceId = useSelector(selectDeviceId)
  const ticket = useSelector(selectActiveTicket)
  const { supported, listening, interim, errorKey, start, stop } = useSpeech()
  const [updateDetails] = useUpdateSosDetailsMutation()
  const [result, setResult] = useState(null)

  if (!supported) return null

  const handle = async () => {
    if (listening) {
      stop()
      return
    }
    setResult(null)
    const transcript = await start(LOCALE_TAGS[i18n.language] ?? 'az-AZ')
    if (!transcript) return
    const parsed = parseTranscript(transcript, i18n.language)
    const details = {
      transcript,
      ...(parsed.needs.length ? { needs: parsed.needs } : {}),
      ...(parsed.headcount ? { headcount: parsed.headcount } : {}),
    }

    const live = ticket && !['resolved', 'cancelled'].includes(ticket.status)
    if (!live) {
      await onSend(parsed.type, details)
    } else if (ticket.status === 'queued' || !ticket.id) {
      dispatch(mergeQueuedDetails({ clientId: ticket.clientId, details }))
      dispatch(detailsSaved(details))
    } else {
      await updateDetails({ clientId: ticket.serverClientId ?? ticket.clientId, deviceId, ...details }).catch(() => null)
      dispatch(detailsSaved(details))
    }
    setResult(transcript)
  }

  return (
    <div>
      <button
        type="button"
        onClick={handle}
        aria-pressed={listening}
        className={clsx(
          'flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-base font-extrabold transition-colors',
          listening ? 'bg-sos text-white' : 'bg-ink text-white hover:bg-ink-soft'
        )}
      >
        {listening ? <Square className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
        {listening ? t('voice.stop') : t('voice.button')}
      </button>
      {listening && (
        <p className="mt-2 text-center text-sm font-semibold text-sos" aria-live="polite">
          {interim || t('voice.listening')}
        </p>
      )}
      {!listening && result && (
        <p className="mt-2 rounded-lg bg-safe-soft px-3 py-2 text-xs font-semibold text-safe" role="status">
          {t('voice.heard', { text: result })} · {t('voice.sentFromVoice')}
        </p>
      )}
      {!listening && errorKey && (
        <p className="mt-2 rounded-lg bg-sos-soft px-3 py-2 text-xs font-semibold text-sos" role="status">
          {t(`voice.${errorKey}`)}
        </p>
      )}
    </div>
  )
}
