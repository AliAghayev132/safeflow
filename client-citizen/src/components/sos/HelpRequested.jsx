import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router'
import { BookOpen, RotateCcw } from 'lucide-react'

import { Icon3D, StatusBadge } from '@components/ui'
import { useNow } from '@hooks'
import { clearTicket } from '@store/slices'
import { ticketStatusMeta, sosTypeIcon } from '@constants'
import { formatElapsed } from '@utils'

/**
 * "Help requested" state: solid concentric rings around the live timer,
 * the ticket status (icon + text + colour) updated from realtime events.
 */
export const HelpRequested = ({ ticket }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const now = useNow(1000)
  const status = ticket.status === 'sending' ? 'pending' : ticket.status
  const meta = ticketStatusMeta[status] ?? ticketStatusMeta.pending
  const done = status === 'resolved' || status === 'cancelled'

  return (
    <section className="rounded-3xl border border-line bg-surface px-4 pb-4 pt-5 text-center">
      <h1 className="text-xl font-extrabold text-ink">{t('help.title')}</h1>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{t('help.subtitle')}</p>

      <div className="relative mx-auto my-5 flex h-56 w-56 items-center justify-center">
        {!done && <span className="pulse-ring absolute inset-0 rounded-full bg-[#fbe2e7]" aria-hidden />}
        <span className="absolute inset-0 rounded-full border-2 border-dashed border-[#f2b8c2]" aria-hidden />
        <span className="absolute inset-5 rounded-full bg-[#fbe2e7]" aria-hidden />
        <span className="absolute inset-10 rounded-full border-[6px] border-white bg-sos" aria-hidden />
        <div className="relative flex flex-col items-center text-white">
          <Icon3D name={sosTypeIcon[ticket.type] ?? 'sos'} size={34} />
          {/* Ticking timer is not announced (would speak every second) */}
          <span className="mt-1 text-2xl font-extrabold tabular-nums" aria-hidden>
            {formatElapsed(ticket.sentAt, now)}
          </span>
          <span className="text-[11px] font-semibold text-white/85">{t(`sos.types.${ticket.type}`)}</span>
        </div>
      </div>

      {/* Live region: ticket status changes (pending → assigned → resolved) */}
      <div role="status" aria-live="polite" aria-atomic="true">
        <StatusBadge tone={meta.tone} icon={meta.icon} size="lg">
          {t(`help.status.${status}`)}
        </StatusBadge>
        <p className="mt-1.5 text-xs font-medium text-muted">{t(`help.statusDesc.${status}`)}</p>
      </div>
      {ticket.approxLocation && (
        <p className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs font-semibold text-warn">{t('sos.locationApprox')}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/guide"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-hover"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {t('help.guideLink')}
        </Link>
        <button
          type="button"
          onClick={() => dispatch(clearTicket())}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong text-sm font-bold text-ink hover:bg-canvas"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          {t('help.newSos')}
        </button>
      </div>
    </section>
  )
}
