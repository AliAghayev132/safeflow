import { useTranslation } from 'react-i18next'
import { CloudOff, Cloud } from 'lucide-react'

import { Icon3D } from '@components/ui'
import { useGetSheltersQuery } from '@store/api'
import { useGetEdgeInfoQuery } from '@store/api/modules/edgeApi'
import { formatTime } from '@utils'

export const feature = 'edgeNode'

/**
 * Shown only when the app is served by an edge node at an assembly point
 * (local Wi-Fi, no internet): SOS and "I am safe" are accepted locally and
 * forwarded to the center when the link is back.
 */
export const Banner = () => {
  const { t } = useTranslation()
  const { data: info } = useGetEdgeInfoQuery(undefined, { pollingInterval: 15000 })
  const { data: shelters = [] } = useGetSheltersQuery(undefined, { skip: !info?.edgeMode })
  if (!info?.edgeMode) return null

  const shelter = shelters.find((s) => s.code === info.shelterCode)?.name ?? info.shelterCode
  const online = info.centralOnline

  return (
    <div role="status" className="border-b border-info bg-info text-white">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
          <Icon3D name="antenna" size={24} />
        </span>
        <div className="min-w-0 flex-1 text-xs">
          <p className="text-sm font-extrabold">{t('edge.title', { shelter })}</p>
          <p className="mt-0.5 text-white/90">{t('edge.desc')}</p>
          <p className="mt-1 flex items-center gap-1.5 font-bold">
            {online ? <Cloud className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}
            {online
              ? t('edge.centerOnline', { time: info.lastSyncAt ? formatTime(info.lastSyncAt) : '—' })
              : t('edge.centerOffline', { count: info.pending ?? 0 })}
          </p>
        </div>
      </div>
    </div>
  )
}

