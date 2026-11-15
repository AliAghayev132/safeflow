import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'

import { selectTriageQueue, selectProfiles } from '@store/slices/liveSlice'
import { Card } from '../ui/Card'
import { Icon3D } from '../ui/Icon3D'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { TriageItem } from './TriageItem'

/**
 * Compact triage queue for the operations board: open SOS by priority,
 * the highest one pinned on top. Full list on the Triage page.
 */
export const TriagePanel = ({ limit = 6, onFocus }) => {
  const { t } = useTranslation()
  const queue = useSelector(selectTriageQueue)
  const profiles = useSelector(selectProfiles)
  const list = queue.slice(0, limit)

  return (
    <Card padding="none">
      <div className="p-4 pb-2">
        <Card.Header
          title={t('triage.title')}
          subtitle={t('triage.subtitle')}
          icon={<Icon3D name="sos" size={28} />}
          className="mb-0"
          actions={
            <>
              <Badge variant={queue.length ? 'critical' : 'neutral'}>{t('triage.total', { count: queue.length })}</Badge>
              <Link
                to="/triage"
                className="inline-flex items-center gap-1 text-xs text-info hover:underline"
              >
                {t('triage.viewAll')} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </>
          }
        />
      </div>
      {list.length === 0 ? (
        <EmptyState icon="safe" title={t('triage.empty')} description={t('triage.emptyHint')} />
      ) : (
        <div className="px-3 pb-3 space-y-2 max-h-[70vh] overflow-y-auto">
          {list.map((s, i) => (
            <TriageItem
              key={s.id}
              sos={s}
              profile={profiles[s.deviceId]}
              pinned={i === 0}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
