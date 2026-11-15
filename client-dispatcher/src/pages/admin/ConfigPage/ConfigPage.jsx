// React
import { useMemo, useState } from 'react'

// Redux
import { useDispatch } from 'react-redux'
import { useGetConfigQuery, useUpdateConfigMutation, useResetConfigMutation, apiErrorMessage } from '@store/api'
import { toast } from '@store/slices/uiSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { Save, RotateCcw, Undo2, Lock, PencilLine } from 'lucide-react'

// Components
import { Card, Button, Icon3D, PageLoader, EmptyState, Badge, useConfirm } from '@components'

// Hooks / helpers
import { useCan } from '@hooks'
import { flatten, getPath, buildPatch, parseValue, formatValue, valueHint } from './configForm'

const SECTION_ICONS = {
  sosCluster: 'siren',
  shelter: 'stadium',
  sos: 'sos',
  triage: 'chart',
  routing: 'motorway',
  brigade: 'fireEngine',
  events: 'antenna',
  rateLimits: 'shield',
}

const Field = ({ path, value, defaultValue, overridden, draft, onChange, readOnly }) => {
  const { t, i18n } = useTranslation()
  const dirty = draft !== undefined
  const shown = dirty ? draft : formatValue(value)
  const label = i18n.exists(`config.fields.${path}`) ? t(`config.fields.${path}`) : path.split('.').slice(1).join(' · ')
  const hint = valueHint(path, dirty ? parseValue(draft, defaultValue) : value)
  const isList = Array.isArray(defaultValue)

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {overridden && !dirty && (
          <Badge size="sm" variant="info">
            <PencilLine className="w-3 h-3" /> {t('config.overridden')}
          </Badge>
        )}
        {dirty && (
          <Badge size="sm" variant="warning">
            ● {t('config.changed', { count: 1 })}
          </Badge>
        )}
      </span>
      <input
        type={isList ? 'text' : 'number'}
        step="any"
        min={0}
        value={shown}
        disabled={readOnly}
        onChange={(e) => onChange(path, e.target.value)}
        className={`h-9 rounded-lg bg-panel-2 border px-3 text-sm text-text tabular-nums focus:outline-none focus:border-info disabled:opacity-70 ${
          dirty ? 'border-warning' : 'border-border'
        }`}
      />
      <span className="flex justify-between gap-2 text-[11px] text-subtle">
        <span className="font-mono truncate" title={path}>
          {path}
        </span>
        <span className="shrink-0">
          {hint && <span className="text-muted mr-2">{t(hint.key, hint.params)}</span>}
          {t('config.default', { value: formatValue(defaultValue) })}
          {isList && ` · ${t('config.listHint')}`}
        </span>
      </span>
    </label>
  )
}

/**
 * Rules-engine configuration editor: every operational threshold (cluster
 * size / window / radius / cooldown, shelter 90/95%, triage weights, routing
 * weights and provider chain, rate limits). Saves a deep-partial PATCH that
 * the backend validates against the defaults and applies live.
 */
export const ConfigPage = () => {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const dispatch = useDispatch()
  const canManage = useCan('config:manage')
  const { data, isLoading, isError } = useGetConfigQuery()
  const [update, { isLoading: saving }] = useUpdateConfigMutation()
  const [reset, { isLoading: resetting }] = useResetConfigMutation()
  const [draft, setDraft] = useState({})

  const sections = useMemo(
    () => (data ? Object.keys(data.defaults).map((key) => ({ key, fields: flatten({ [key]: data.effective[key] }) })) : []),
    [data]
  )

  if (isLoading) return <PageLoader />
  if (isError || !data) return <EmptyState icon="gear" title={t('app.loadFailed')} />

  const dirtyCount = Object.keys(draft).length

  const onChange = (path, raw) =>
    setDraft((d) => {
      const next = { ...d }
      if (raw === formatValue(getPath(data.effective, path))) delete next[path]
      else next[path] = raw
      return next
    })

  const save = async () => {
    const parsed = Object.fromEntries(
      Object.entries(draft).map(([path, raw]) => [path, parseValue(raw, getPath(data.defaults, path))])
    )
    try {
      await update(buildPatch(parsed)).unwrap()
      setDraft({})
      dispatch(toast.success('toast.configSaved'))
    } catch (error) {
      dispatch(toast.error(apiErrorMessage(error)))
    }
  }

  const onReset = async () => {
    if (!(await confirm({ title: t('config.reset'), message: t('config.resetConfirm'), tone: 'warning', confirmLabel: t('config.reset') }))) return
    try {
      await reset().unwrap()
      setDraft({})
      dispatch(toast.success('toast.configReset'))
    } catch (error) {
      dispatch(toast.error(apiErrorMessage(error)))
    }
  }

  return (
    <div className="p-5 space-y-4">
      <Card className="flex flex-wrap items-center gap-4">
        <Icon3D name="gear" size={40} />
        <div className="flex-1 min-w-60">
          <h2 className="font-semibold">{t('config.title')}</h2>
          <p className="text-xs text-muted">{t('config.subtitle')}</p>
          {!canManage && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> {t('config.readOnly')}
            </p>
          )}
        </div>
        <Badge variant="neutral">{t('config.version', { version: data.version })}</Badge>
        {canManage && (
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && <Badge variant="warning">{t('config.changed', { count: dirtyCount })}</Badge>}
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirtyCount}
              onClick={() => setDraft({})}
              leftIcon={<Undo2 className="w-4 h-4" />}
            >
              {t('config.discard')}
            </Button>
            <Button size="sm" disabled={!dirtyCount} loading={saving} onClick={save} leftIcon={<Save className="w-4 h-4" />}>
              {t('config.save')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={resetting}
              onClick={onReset}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              {t('config.reset')}
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {sections.map(({ key, fields }) => (
          <Card key={key}>
            <Card.Header
              title={t(`config.sections.${key}`, { defaultValue: key })}
              subtitle={<span className="font-mono">{key}</span>}
              icon={<Icon3D name={SECTION_ICONS[key] ?? 'gear'} size={28} />}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {fields.map(({ path, value }) => (
                <Field
                  key={path}
                  path={path}
                  value={value}
                  defaultValue={getPath(data.defaults, path)}
                  overridden={getPath(data.overrides, path) !== undefined}
                  draft={draft[path]}
                  onChange={onChange}
                  readOnly={!canManage}
                />
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
