import { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { ImageUp, Plane, Undo2, MapPinCheck } from 'lucide-react'

import { Card, Button, Icon3D, Select, PageLoader, StatusBadge, Badge, useConfirm } from '@components'
import { selectZones } from '@store/slices/liveSlice'
import { useAction } from '@store/hooks'
import { MAP_CENTER } from '@constants'
import { formatAgo } from '@utils'
import { useNow } from '@hooks'
import { useGetDamageQuery, useAssessImageMutation, useDroneSurveyMutation, useRevertDamageMutation, useApproveDamageMutation } from '../api'
import { useAiLive, AI_POLL_MS, SEVERITY_META, ProviderBadge } from '../shared'

const TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'

/**
 * AI damage assessment from drone frames / photos: severity (none /
 * partial / blocked / collapsed), automatic road status update on the map,
 * revert for false positives, simulated drone survey for demos.
 */
export const DamagePage = () => {
  const { t } = useTranslation()
  useAiLive()
  const now = useNow(15000)
  const run = useAction()
  const confirm = useConfirm()
  const zones = useSelector(selectZones)
  const fileRef = useRef(null)
  const [zoneCode, setZoneCode] = useState('')
  const [frames, setFrames] = useState('6')
  const { data: list = [], isLoading } = useGetDamageQuery(undefined, { pollingInterval: AI_POLL_MS })
  const [assess, { isLoading: uploading }] = useAssessImageMutation()
  const [survey, { isLoading: surveying }] = useDroneSurveyMutation()
  const [revert] = useRevertDamageMutation()
  const [approve] = useApproveDamageMutation()

  const zone = zones.find((z) => z.code === (zoneCode || zones[0]?.code))
  const upload = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !zone) return
    run(assess({ file, lat: zone.center?.lat ?? zone.lat, lng: zone.center?.lng ?? zone.lng, source: 'drone' }), 'ai.damage.queued')
  }
  const onRevert = async (a) => {
    if (await confirm({ message: t('ai.damage.revertConfirm', { count: a.applied.length }), tone: 'warning', confirmLabel: t('ai.damage.revert') })) {
      run(revert(a.id), 'ai.damage.reverted')
    }
  }

  if (isLoading) return <PageLoader />
  const counts = Object.fromEntries(Object.keys(SEVERITY_META).map((k) => [k, list.filter((a) => a.severity === k).length]))

  return (
    <div className="space-y-4 p-4">
      <Card className="flex flex-wrap items-end gap-3">
        <Icon3D name="helicopter" size={38} />
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">{t('ai.damage.title')}</h2>
          <p className="text-xs text-muted">{t('ai.damage.subtitle')}</p>
        </div>
        <Select
          className="w-48"
          size="sm"
          label={t('ai.damage.zone')}
          value={zoneCode || zones[0]?.code || ''}
          onValueChange={setZoneCode}
          options={zones.map((z) => ({ value: z.code, label: z.name }))}
        />
        <Select
          className="w-28"
          size="sm"
          label={t('ai.damage.frames')}
          value={frames}
          onValueChange={setFrames}
          options={['4', '6', '10', '15'].map((v) => ({ value: v, label: v }))}
        />
        <Button size="sm" loading={surveying} onClick={() => run(survey({ zoneCode: zone?.code, frames: Number(frames) }), 'ai.damage.surveyStarted')} leftIcon={<Plane className="h-4 w-4" />}>
          {t('ai.damage.survey')}
        </Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
        <Button size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()} leftIcon={<ImageUp className="h-4 w-4" />}>
          {t('ai.damage.upload')}
        </Button>
      </Card>

      <div className="flex flex-wrap gap-2">
        {Object.entries(SEVERITY_META).map(([k, meta]) => (
          <StatusBadge key={k} meta={meta} label={`${t(`ai.severity.${k}`)} · ${counts[k]}`} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card padding="none" className="h-[460px] overflow-hidden">
          <MapContainer center={MAP_CENTER} zoom={13} className="h-full w-full" preferCanvas>
            <TileLayer url={TILE} attribution="Esri" />
            {list
              .filter((a) => a.severity)
              .map((a) => (
                <CircleMarker
                  key={a.id}
                  center={[a.lat, a.lng]}
                  radius={a.severity === 'none' ? 6 : 10}
                  pathOptions={{ color: SEVERITY_META[a.severity].color, fillColor: SEVERITY_META[a.severity].color, fillOpacity: a.status === 'reverted' ? 0.2 : 0.85, weight: 2 }}
                >
                  <Tooltip>
                    {t(`ai.severity.${a.severity}`)} · {Math.round((a.confidence ?? 0) * 100)}%
                  </Tooltip>
                </CircleMarker>
              ))}
          </MapContainer>
        </Card>

        <Card padding="none" className="max-h-[460px] overflow-y-auto">
          <ul className="divide-y divide-border">
            {list.length === 0 && <li className="p-4 text-sm text-muted">{t('ai.damage.empty')}</li>}
            {list.map((a) => (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.status === 'queued' ? (
                      <Badge size="sm" variant="info">{t('ai.damage.queued')}</Badge>
                    ) : a.severity ? (
                      <StatusBadge size="sm" meta={SEVERITY_META[a.severity]} label={t(`ai.severity.${a.severity}`)} />
                    ) : (
                      <Badge size="sm" variant="critical">{t('ai.damage.failed')}</Badge>
                    )}
                    {a.confidence != null && <span className="text-xs tabular-nums text-muted">{Math.round(a.confidence * 100)}%</span>}
                    {a.status === 'reverted' && <Badge size="sm" variant="neutral">{t('ai.damage.revertedBadge')}</Badge>}
                    {a.provider && <ProviderBadge provider={a.provider} mock={a.mock} />}
                    <span className="ml-auto text-[11px] text-subtle">{formatAgo(a.createdAt, now)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {t(`ai.damage.source.${a.source}`)}
                    {a.droneCode ? ` · ${a.droneCode}` : ''}
                    {a.hazards?.length ? ` · ${a.hazards.join(', ')}` : ''}
                  </p>
                  {a.status === 'done' && a.applied.length === 0 && ['partial', 'blocked', 'collapsed'].includes(a.severity) && (
                    <p className="mt-1 text-xs font-semibold text-info">{t('ai.damage.proposal')}</p>
                  )}
                  {a.applied.length > 0 && (
                    <p className="mt-1 text-xs font-semibold text-warning">
                      {t('ai.damage.applied', { closed: a.applied.filter((x) => x.action === 'closed').length, damaged: a.applied.filter((x) => x.action === 'damaged').length })}
                    </p>
                  )}
                </div>
                {a.status === 'done' && a.applied.length === 0 && ['partial', 'blocked', 'collapsed'].includes(a.severity) && (
                  <Button size="sm" variant="critical" onClick={() => run(approve(a.id), 'ai.damage.approved')} leftIcon={<MapPinCheck className="h-3.5 w-3.5" />}>
                    {t('ai.damage.approve')}
                  </Button>
                )}
                {a.applied.length > 0 && a.status !== 'reverted' && (
                  <Button size="sm" variant="ghost" onClick={() => onRevert(a)} leftIcon={<Undo2 className="h-3.5 w-3.5" />}>
                    {t('ai.damage.revert')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
