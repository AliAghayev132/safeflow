import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { MapPin, Clock } from 'lucide-react'

import { Icon3D, PageLoader, EmptyState, LanguageSwitcher, StatusBadge } from '@components/ui'
import { useGetSafeShareQuery } from '@store/api'
import { formatDateTime } from '@utils'

/** Public "I'm safe" page opened by family members from a shared link. */
export const SafeStatusPage = () => {
  const { t } = useTranslation()
  const { token } = useParams()
  const { data: share, isLoading, error } = useGetSafeShareQuery(token)

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon3D name="shield" size={28} />
          <span className="text-sm font-extrabold text-ink">{t('safe.publicTitle')}</span>
        </div>
        <LanguageSwitcher />
      </div>

      {isLoading && <PageLoader />}
      {error && !share && <EmptyState icon="warning" title={t('safe.notFound')} />}

      {share && (
        <section className="rounded-3xl border border-line bg-surface p-5 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-safe-soft">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-safe">
              <Icon3D name="safe" size={44} />
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-ink">
            {t('safe.publicSafe', { name: share.displayName || t('safe.anonymous') })}
          </h1>
          <div className="mt-2">
            <StatusBadge tone="ok" icon="check" size="lg">
              {t('citizenStatus.safe')}
            </StatusBadge>
          </div>
          {share.message && <p className="mt-3 text-sm text-ink-soft">“{share.message}”</p>}

          <ul className="mt-5 space-y-2 text-left text-sm">
            <li className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 font-semibold text-ink">
              <Clock className="h-4 w-4 text-brand" aria-hidden />
              {t('safe.publicAt', { time: formatDateTime(share.at) })}
            </li>
            {share.shelterName && (
              <li className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 font-semibold text-ink">
                <Icon3D name="shelter" size={18} />
                {t('safe.publicShelter', { name: share.shelterName })}
              </li>
            )}
            {Number.isFinite(share.lat) && (
              <li>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${share.lat}&mlon=${share.lng}#map=16/${share.lat}/${share.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-brand px-3 py-3 font-bold text-white hover:bg-brand-hover"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  {t('safe.publicLocation')} · {t('safe.openMap')}
                </a>
              </li>
            )}
          </ul>
          <p className="mt-4 text-xs text-muted">{t('safe.publicExpires', { time: formatDateTime(share.expiresAt) })}</p>
        </section>
      )}
    </div>
  )
}
