import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { WifiOff, Clock } from 'lucide-react'

import { selectNetwork, selectIsOffline, selectOutbox } from '@store/slices'
import { formatDateTime } from '@utils'

/**
 * Offline warning with the age of the saved data, plus the number of SOS
 * waiting in the outbox.
 */
export const OfflineBanner = () => {
  const { t } = useTranslation()
  const network = useSelector(selectNetwork)
  const offline = useSelector(selectIsOffline)
  const outbox = useSelector(selectOutbox)

  if (!offline && outbox.length === 0) return null

  return (
    <div role="status" className="sticky top-14 z-[490] border-b border-ink bg-ink text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs font-bold">
        {offline && (
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            {network.dataUpdatedAt
              ? t('offline.banner', { time: formatDateTime(network.dataUpdatedAt) })
              : t('offline.bannerNoData')}
          </span>
        )}
        {outbox.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-md bg-warn px-2 py-0.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('help.status.queued')} · {outbox.length}
          </span>
        )}
      </div>
    </div>
  )
}
