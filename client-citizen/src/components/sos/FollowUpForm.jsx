import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { Minus, Plus, Check } from 'lucide-react'

import { Button } from '@components/ui'
import { useUpdateSosDetailsMutation } from '@store/api'
import { selectDeviceId, detailsSaved, mergeQueuedDetails } from '@store/slices'
import { sosNeeds, vulnerableFlags } from '@constants'
import { errorMessage } from '@utils'

const Toggle = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={clsx(
      'flex min-h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors',
      active ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink hover:bg-surface-strong'
    )}
  >
    {active && <Check className="h-4 w-4" aria-hidden />}
    {children}
  </button>
)

/**
 * Optional, non-blocking follow-up questions attached to the live ticket.
 * Queued (offline) tickets keep the answers in the outbox payload.
 */
export const FollowUpForm = ({ ticket }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const deviceId = useSelector(selectDeviceId)
  const [save, { isLoading }] = useUpdateSosDetailsMutation()

  const initial = ticket.details ?? {}
  const [headcount, setHeadcount] = useState(initial.headcount ?? 1)
  const [vulnerable, setVulnerable] = useState(initial.vulnerable ?? {})
  const [needs, setNeeds] = useState(initial.needs ?? [])
  const [injuries, setInjuries] = useState(initial.injuries ?? '')
  const [feedback, setFeedback] = useState(null)

  const toggleNeed = (n) => setNeeds((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]))

  const submit = async () => {
    const details = { headcount, vulnerable, needs, ...(injuries.trim() ? { injuries: injuries.trim() } : {}) }
    setFeedback(null)
    if (ticket.status === 'queued' || !ticket.id) {
      dispatch(mergeQueuedDetails({ clientId: ticket.clientId, details }))
      dispatch(detailsSaved(details))
      setFeedback({ ok: true, text: t('help.statusDesc.queued') })
      return
    }
    try {
      await save({ clientId: ticket.serverClientId ?? ticket.clientId, deviceId, ...details }).unwrap()
      dispatch(detailsSaved(details))
      setFeedback({ ok: true, text: t('help.detailsSaved') })
    } catch (error) {
      setFeedback({ ok: false, text: errorMessage(error) })
    }
  }

  if (['resolved', 'cancelled'].includes(ticket.status)) return null

  return (
    <section className="rounded-3xl bg-surface p-4">
      <h2 className="text-base font-extrabold text-ink">{t('help.followTitle')}</h2>
      <p className="mt-0.5 text-xs text-muted">{t('help.followHint')}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-ink">{t('help.headcount')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="-1"
            onClick={() => setHeadcount((n) => Math.max(1, n - 1))}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-line-strong text-ink"
          >
            <Minus className="h-5 w-5" />
          </button>
          <span className="w-8 text-center text-xl font-extrabold tabular-nums" aria-live="polite">{headcount}</span>
          <button
            type="button"
            aria-label="+1"
            onClick={() => setHeadcount((n) => Math.min(50, n + 1))}
            className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-line-strong text-ink"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm font-bold text-ink">{t('help.vulnerable')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {vulnerableFlags.map((f) => (
          <Toggle key={f} active={Boolean(vulnerable[f])} onClick={() => setVulnerable((v) => ({ ...v, [f]: !v[f] }))}>
            {t(`help.${f}`)}
          </Toggle>
        ))}
      </div>

      <p className="mt-4 text-sm font-bold text-ink">{t('help.needs')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sosNeeds.map((n) => (
          <Toggle key={n} active={needs.includes(n)} onClick={() => toggleNeed(n)}>
            {t(`needs.${n}`)}
          </Toggle>
        ))}
      </div>

      <label htmlFor="injuries" className="mt-4 block text-sm font-bold text-ink">
        {t('help.injuries')}
      </label>
      <input
        id="injuries"
        value={injuries}
        onChange={(e) => setInjuries(e.target.value)}
        maxLength={280}
        placeholder={t('help.injuriesPlaceholder')}
        className="mt-2 h-12 w-full rounded-xl border-2 border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
      />

      <Button size="lg" fullWidth className="mt-4" loading={isLoading} onClick={submit}>
        {t('help.send')}
      </Button>
      {feedback && (
        <p
          role="status"
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${feedback.ok ? 'bg-safe-soft text-safe' : 'bg-sos-soft text-sos'}`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  )
}
