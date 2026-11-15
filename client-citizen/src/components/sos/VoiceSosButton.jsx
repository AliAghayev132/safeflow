import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { Mic, Square } from 'lucide-react'

import { useSpeech, useFeature } from '@hooks'
import { Spinner } from '@components/ui'
import { useUpdateSosDetailsMutation } from '@store/api'
import {
  selectActiveTicket,
  selectDeviceId,
  detailsSaved,
  mergeQueuedDetails,
  ticketStarted,
  ticketAccepted,
} from '@store/slices'
import { useAiVoiceSosMutation, useAiCoords } from '@/modules/assistant'
import { LOCALE_TAGS } from '@/i18n'
import { CITY_CENTER } from '@constants'
import { parseTranscript } from '@utils'

// The SOS page remounts this button when the ticket appears; keep the AI
// result for that ticket so the summary card survives the switch.
let lastAiResult = null

/**
 * Voice SOS for people who can't type (trapped, injured).
 *   - no live ticket + `aiVoiceSos` flag + online → POST /api/ai/voice-sos
 *     (server parses hazard, people, priority, location) and a compact
 *     result card is shown; on any error → legacy path below
 *   - legacy: transcript parsed locally, normal SOS sent (works offline)
 *   - live ticket → the transcript is attached to it
 * Hidden when the browser has no speech recognition.
 */
export const VoiceSosButton = ({ onSend }) => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const deviceId = useSelector(selectDeviceId)
  const ticket = useSelector(selectActiveTicket)
  const aiEnabled = useFeature('aiVoiceSos')
  const coords = useAiCoords()
  const { supported, listening, interim, errorKey, start, stop } = useSpeech()
  const [updateDetails] = useUpdateSosDetailsMutation()
  const [voiceSos, { isLoading: aiSending }] = useAiVoiceSosMutation()
  const [result, setResult] = useState(null)
  const [aiResult, setAiResult] = useState(() =>
    lastAiResult && ticket?.clientId === lastAiResult.clientId ? lastAiResult : null
  )

  if (!supported) return null

  const sendViaAi = async (transcript) => {
    const clientId = crypto.randomUUID()
    const point = coords ?? CITY_CENTER
    const res = await voiceSos({
      deviceId,
      clientId,
      transcript,
      lat: point.lat,
      lng: point.lng,
      language: i18n.language,
    }).unwrap()
    if (!res?.sos) throw new Error('no sos')
    dispatch(ticketStarted({ clientId, type: res.sos.type, sentAt: new Date().toISOString(), approxLocation: !coords }))
    dispatch(ticketAccepted(res.sos))
    navigator.vibrate?.([200, 80, 200])
    const summary = { clientId, parsed: res.parsed ?? {} }
    lastAiResult = summary
    setAiResult(summary)
  }

  const handle = async () => {
    if (listening) {
      stop()
      return
    }
    setResult(null)
    setAiResult(null)
    const transcript = await start(LOCALE_TAGS[i18n.language] ?? 'az-AZ')
    if (!transcript) return

    const live = ticket && !['resolved', 'cancelled'].includes(ticket.status)

    if (!live && aiEnabled && navigator.onLine) {
      try {
        await sendViaAi(transcript)
        return
      } catch {
        // fall through to the legacy (local parse) path
      }
    }

    const parsed = parseTranscript(transcript, i18n.language)
    const details = {
      transcript,
      ...(parsed.needs.length ? { needs: parsed.needs } : {}),
      ...(parsed.headcount ? { headcount: parsed.headcount } : {}),
    }

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
    <div className="space-y-2">
      <button
        type="button"
        onClick={handle}
        disabled={aiSending}
        aria-pressed={listening}
        className={clsx(
          'flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-base font-extrabold transition-[background-color,transform] active:scale-[0.97] disabled:opacity-80',
          listening ? 'bg-sos text-white' : 'bg-ink text-white hover:bg-ink-soft'
        )}
      >
        {aiSending ? (
          <Spinner className="h-5 w-5" />
        ) : listening ? (
          <Square className="h-5 w-5" aria-hidden />
        ) : (
          <Mic className="h-5 w-5" aria-hidden />
        )}
        {aiSending ? t('voiceAi.sending') : listening ? t('voice.stop') : t('voice.button')}
      </button>
      {listening && (
        <p className="text-center text-sm font-semibold text-sos" aria-live="polite">
          {interim || t('voice.listening')}
        </p>
      )}
      {!listening && aiResult && <AiVoiceResult parsed={aiResult.parsed} />}
      {!listening && result && (
        <p className="rounded-lg bg-safe-soft px-3 py-2 text-xs font-semibold text-safe" role="status">
          {t('voice.heard', { text: result })} · {t('voice.sentFromVoice')}
        </p>
      )}
      {!listening && errorKey && (
        <p className="rounded-lg bg-sos-soft px-3 py-2 text-xs font-semibold text-sos" role="status">
          {t(`voice.${errorKey}`)}
        </p>
      )}
    </div>
  )
}

const PRIORITY_TONE = {
  critical: 'bg-sos text-white',
  high: 'bg-full-soft text-full',
  medium: 'bg-warn-soft text-warn',
  low: 'bg-safe-soft text-safe',
}

/** Compact summary of what the AI understood from the voice SOS. */
const AiVoiceResult = ({ parsed }) => {
  const { t } = useTranslation()
  const loc = parsed.location ?? {}
  const locationText = [
    loc.text,
    loc.zoneCode,
    loc.floor != null && loc.floor !== '' ? t('voiceAi.floor', { floor: loc.floor }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="pop-in rounded-3xl bg-safe-soft p-4" role="status">
      <p className="mb-3 text-sm font-extrabold text-safe">{t('voiceAi.title')}</p>
      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-canvas px-3 py-2">
          <dt className="text-[11px] font-semibold text-muted">{t('voiceAi.hazard')}</dt>
          <dd className="truncate text-sm font-extrabold text-ink">
            {parsed.hazardType ? t(`sos.types.${parsed.hazardType}`, { defaultValue: parsed.hazardType }) : '—'}
          </dd>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-2">
          <dt className="text-[11px] font-semibold text-muted">{t('voiceAi.people')}</dt>
          <dd className="text-sm font-extrabold text-ink">{parsed.peopleCount ?? '—'}</dd>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-2">
          <dt className="text-[11px] font-semibold text-muted">{t('voiceAi.priority')}</dt>
          <dd>
            {parsed.priority ? (
              <span
                className={clsx(
                  'inline-block rounded-full px-2 py-0.5 text-xs font-extrabold',
                  PRIORITY_TONE[parsed.priority] ?? 'bg-surface text-ink'
                )}
              >
                {t(`voiceAi.priorities.${parsed.priority}`, { defaultValue: parsed.priority })}
              </span>
            ) : (
              <span className="text-sm font-extrabold text-ink">—</span>
            )}
          </dd>
        </div>
      </dl>
      {(locationText || parsed.trapped || parsed.needs?.length > 0) && (
        <div className="mt-2 space-y-1 rounded-2xl bg-canvas px-3 py-2 text-xs font-semibold text-ink">
          {locationText && (
            <p>
              <span className="text-muted">{t('voiceAi.location')}: </span>
              {locationText}
            </p>
          )}
          {parsed.needs?.length > 0 && (
            <p>
              <span className="text-muted">{t('voiceAi.needs')}: </span>
              {parsed.needs.map((n) => t(`followUp.needs.${n}`, { defaultValue: n })).join(', ')}
            </p>
          )}
          {parsed.trapped && <p className="font-extrabold text-sos">{t('voiceAi.trapped')}</p>}
        </div>
      )}
    </div>
  )
}
