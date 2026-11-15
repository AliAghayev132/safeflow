import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { StatusBadge } from '@components/ui'
import { selectNetwork, selectIsOffline } from '@store/slices'

/** Realtime transport state: icon + text + colour. */
export const ConnectionPill = () => {
  const { t } = useTranslation()
  const { transport } = useSelector(selectNetwork)
  const offline = useSelector(selectIsOffline)

  if (offline || transport === 'offline') {
    return (
      <StatusBadge tone="sos" icon="offline">
        <span title={t('common.connectionOffline')}>{t('common.offline')}</span>
      </StatusBadge>
    )
  }
  if (transport === 'polling') {
    return (
      <StatusBadge tone="busy" icon="polling">
        <span title={t('common.connectionPolling')}>{t('common.polling')}</span>
      </StatusBadge>
    )
  }
  return (
    <StatusBadge tone={transport === 'socket' ? 'ok' : 'neutral'} icon="live">
      <span title={t('common.connectionLive')}>{t('common.live')}</span>
    </StatusBadge>
  )
}
