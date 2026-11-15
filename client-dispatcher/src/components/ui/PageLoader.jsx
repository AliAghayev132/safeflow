import { useTranslation } from 'react-i18next'
import { Icon3D } from './Icon3D'

export const PageLoader = ({ label }) => {
  const { t } = useTranslation()
  return (
    <div className="min-h-[60vh] h-full w-full flex flex-col items-center justify-center gap-3">
      <Icon3D name="antenna" size={56} className="animate-pulse" />
      <p className="text-sm text-muted">{label ?? t('app.loading')}</p>
    </div>
  )
}
