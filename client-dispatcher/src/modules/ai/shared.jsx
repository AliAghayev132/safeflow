/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CircleCheck, CircleDot, OctagonX, Construction, Cpu, FlaskConical } from 'lucide-react'
import { useSocket } from '@store/context'
import { baseApi } from '@store/api/baseApi'
import { Badge } from '@components'

const TAGS_BY_TYPE = {
  'ai:forecast': ['AiForecast'],
  'ai:supply-plan': ['AiPlan'],
  'ai:damage': ['AiDamage'],
  'road:updated': ['AiDamage'],
}

/** Live AI updates → coalesced RTK Query refetch (≤ 1 per second). */
export const useAiLive = () => {
  const { socket } = useSocket()
  const dispatch = useDispatch()
  useEffect(() => {
    if (!socket) return undefined
    let pending = new Set()
    let timer = null
    const flush = () => {
      timer = null
      if (pending.size) dispatch(baseApi.util.invalidateTags([...pending]))
      pending = new Set()
    }
    const onEvt = (evt) => {
      const tags = TAGS_BY_TYPE[evt?.type]
      if (!tags) return
      tags.forEach((t) => pending.add(t))
      if (!timer) timer = setTimeout(flush, 1000)
    }
    socket.on('evt', onEvt)
    return () => {
      socket.off('evt', onEvt)
      clearTimeout(timer)
    }
  }, [socket, dispatch])
}

export const AI_POLL_MS = 30000

// Status = colour + icon + text
export const RISK_META = {
  normal: { variant: 'success', Icon: CircleCheck },
  elevated: { variant: 'info', Icon: CircleDot },
  critical: { variant: 'warning', Icon: AlertTriangle },
  overflow: { variant: 'critical', Icon: OctagonX },
}

export const SEVERITY_META = {
  none: { variant: 'success', Icon: CircleCheck, color: '#30a46c' },
  partial: { variant: 'warning', Icon: Construction, color: '#f5a524' },
  blocked: { variant: 'critical', Icon: OctagonX, color: '#e5484d' },
  collapsed: { variant: 'solidCritical', Icon: OctagonX, color: '#c93a3f' },
}

/** "Real model" vs "demo data" marker shown next to every AI result. */
export const ProviderBadge = ({ provider, mock }) => {
  const { t } = useTranslation()
  return mock ? (
    <Badge size="sm" variant="neutral">
      <FlaskConical className="h-3 w-3" aria-hidden /> {t('ai.mock')}
    </Badge>
  ) : (
    <Badge size="sm" variant="info">
      <Cpu className="h-3 w-3" aria-hidden /> {provider}
    </Badge>
  )
}

export const pct = (v) => `${Math.round((v ?? 0) * 100)}%`
