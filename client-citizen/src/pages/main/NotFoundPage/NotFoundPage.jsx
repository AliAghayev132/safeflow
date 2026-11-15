import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@components'

export const NotFoundPage = () => {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon="warning"
      title={t('notFound.title')}
      description={t('notFound.desc')}
      action={
        <Link
          to="/"
          className="inline-flex h-12 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          {t('notFound.back')}
        </Link>
      }
    />
  )
}
