import { useTranslation } from 'react-i18next'
import { CircleCheck, Minus } from 'lucide-react'
import { Card, Icon3D, PageLoader, EmptyState, Badge, StatusBadge } from '@components'
import { useGetAiStatusQuery } from '../api'
import { ProviderBadge } from '../shared'

/**
 * Which provider each AI capability uses right now (real model or demo
 * mock), which ones are configured in env, and the AI feature flags.
 * Keys are never shown — only whether a provider is available.
 */
export const AiStatusPage = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useGetAiStatusQuery(undefined, { pollingInterval: 60000 })
  if (isLoading) return <PageLoader />
  if (!data) return <EmptyState icon="gear" title={t('app.loadFailed')} />

  return (
    <div className="space-y-4 p-4">
      <Card className="flex items-center gap-3">
        <Icon3D name="bullseye" size={38} />
        <div>
          <h2 className="font-semibold">{t('ai.status.title')}</h2>
          <p className="text-xs text-muted">{t('ai.status.subtitle')}</p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.entries(data.providers).map(([cap, p]) => (
          <Card key={cap}>
            <Card.Header title={t(`ai.status.cap.${cap}`)} subtitle={t('ai.status.configured', { value: p.configured })} />
            <div className="mb-3 flex items-center gap-2 text-sm">
              {t('ai.status.active')}: <ProviderBadge provider={p.active} mock={p.active === 'mock'} />
            </div>
            <ul className="space-y-1.5">
              {Object.entries(p.available).map(([name, ok]) => (
                <li key={name} className="flex items-center justify-between text-sm">
                  <span>{t(`ai.status.provider.${name}`, { defaultValue: name })}</span>
                  <StatusBadge
                    size="sm"
                    meta={ok ? { variant: 'success', Icon: CircleCheck } : { variant: 'neutral', Icon: Minus }}
                    label={ok ? t('ai.status.available') : t('ai.status.notConfigured')}
                  />
                </li>
              ))}
            </ul>
            {cap === 'llm' && <p className="mt-3 text-xs text-muted">{t('ai.status.model', { model: data.model })}</p>}
          </Card>
        ))}
      </div>

      <Card>
        <Card.Header title={t('ai.status.flags')} />
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.features).map(([k, on]) => (
            <Badge key={k} variant={on ? 'success' : 'neutral'}>
              {t(`config.features.${k}.name`, { defaultValue: k })}: {on ? t('config.on') : t('config.off')}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{t('ai.status.howTo')}</p>
      </Card>
    </div>
  )
}
