import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@components'

export const NotFoundPage = () => {
  const { t } = useTranslation()
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <EmptyState icon="compass" title={t('notFound.title')} description={t('notFound.description')} />
      <Link to="/" className="text-sm text-info hover:underline">
        {t('notFound.back')}
      </Link>
    </div>
  )
}
