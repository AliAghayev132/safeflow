import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { Icon3D, GuideSteps, EmergencyNumbers, SafetyTips } from '@components'
import { selectActiveTicket } from '@store/slices'
import { guideForSosType } from '@constants'

/**
 * "What to do now" — survival steps per disaster (auto-selected from the
 * active SOS), emergency numbers and short safety instructions. All bundled
 * in the app, so it works offline.
 */
export const GuidePage = () => {
  const { t } = useTranslation()
  const ticket = useSelector(selectActiveTicket)
  const suggested = ticket ? guideForSosType[ticket.type] : null
  const [value, setValue] = useState(suggested ?? 'earthquake')

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center gap-3">
        <Icon3D name="megaphone" size={44} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('guide.title')}</h1>
          <p className="text-sm text-muted">{t('guide.subtitle')}</p>
        </div>
      </div>
      <GuideSteps value={value} onChange={setValue} highlight={Boolean(suggested) && value === suggested} />
      <EmergencyNumbers />
      <SafetyTips />
    </div>
  )
}
