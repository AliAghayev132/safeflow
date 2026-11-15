// React
import { useMemo, useState } from 'react'

// Redux
import { useDispatch } from 'react-redux'
import { useGetConfigQuery, useUpdateConfigMutation, useResetConfigMutation, apiErrorMessage } from '@store/api'
import { toast } from '@store/slices/uiSlice'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { Save, RotateCcw, Undo2, Lock, Search, X, Plus, CircleDot } from 'lucide-react'

// Components
import { Card, Button, Icon3D, PageLoader, EmptyState, Badge, useConfirm } from '@components'
import { clsx } from 'clsx'

// Hooks / helpers
import { useCan } from '@hooks'
import {
  getPath,
  buildPatch,
  parseValue,
  formatValue,
  valueHint,
  humanize,
  unitOf,
  sameValue,
  categorize,
  groupFields,
} from './configForm'

const SECTION_ICONS = {
  features: 'gear',
  sosCluster: 'siren',
  shelter: 'stadium',
  sos: 'sos',
  triage: 'chart',
  routing: 'motorway',
  brigade: 'fireEngine',
  events: 'antenna',
  rateLimits: 'shield',
  drones: 'helicopter',
  volunteers: 'people',
  partner: 'megaphone',
  edge: 'antenna',
  accessibility: 'safe',
  ai: 'bullseye',
}

// ---------------------------------------------------------------- controls

const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-success' : 'bg-panel-3 border border-border-strong'
    )}
  >
    <span
      className={clsx(
        'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
      )}
    />
  </button>
)

const TagInput = ({ value, onChange, disabled, label }) => {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const add = () => {
    const v = text.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setText('')
  }
  return (
    <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-panel-2 p-1.5 focus-within:border-info">
      {value.map((item, i) => (
        <span key={item} className="inline-flex h-7 items-center gap-1 rounded-md bg-panel-3 pl-2 pr-1 text-xs font-medium text-text">
          <span className="tabular-nums text-subtle">{i + 1}.</span> {item}
          {!disabled && (
            <button
              type="button"
              aria-label={t('config.removeItem', { item })}
              onClick={() => onChange(value.filter((x) => x !== item))}
              className="flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-panel hover:text-critical cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <span className="flex min-w-28 flex-1 items-center">
          <input
            value={text}
            aria-label={label}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                add()
              }
              if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
            }}
            placeholder={t('config.addItem')}
            className="h-7 w-full bg-transparent px-1.5 text-xs text-text placeholder:text-subtle focus:outline-none"
          />
          {text && (
            <button type="button" onClick={add} aria-label={t('config.addItem')} className="text-info cursor-pointer">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </span>
      )}
    </div>
  )
}

const fieldLabel = (t, i18n, path) => {
  if (i18n.exists(`config.fields.${path}`)) return t(`config.fields.${path}`)
  return humanize(path.split('.').at(-1))
}

/** One setting row: label + help on the left, control on the right. */
const FieldRow = ({ path, value, defaultValue, overridden, draft, onChange, readOnly }) => {
  const { t, i18n } = useTranslation()
  const dirty = draft !== undefined
  const current = dirty ? draft : value
  const label = fieldLabel(t, i18n, path)
  const help = i18n.exists(`config.help.${path}`) ? t(`config.help.${path}`) : null
  const unit = unitOf(path)
  const hint = valueHint(path, typeof current === 'number' ? current : Number(current))
  const isDefault = sameValue(parseValue(current, defaultValue), defaultValue)

  let control
  if (typeof defaultValue === 'boolean') {
    control = <Switch checked={current === true} onChange={(v) => onChange(path, v)} disabled={readOnly} label={label} />
  } else if (Array.isArray(defaultValue)) {
    control = <TagInput value={current ?? []} onChange={(v) => onChange(path, v)} disabled={readOnly} label={label} />
  } else if (typeof defaultValue === 'number') {
    control = (
      <div
        className={clsx(
          'flex h-10 w-full items-center rounded-lg border bg-panel-2 focus-within:border-info',
          dirty ? 'border-warning' : 'border-border',
          readOnly && 'opacity-70'
        )}
      >
        <input
          type="number"
          step="any"
          min={0}
          aria-label={label}
          value={formatValue(current)}
          disabled={readOnly}
          onChange={(e) => onChange(path, e.target.value)}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm tabular-nums text-text focus:outline-none"
        />
        {unit && <span className="shrink-0 pr-3 text-xs font-medium text-subtle">{t(`config.units.${unit}`)}</span>}
      </div>
    )
  } else {
    control = (
      <input
        aria-label={label}
        value={formatValue(current)}
        disabled={readOnly}
        onChange={(e) => onChange(path, e.target.value)}
        className={clsx(
          'h-10 w-full rounded-lg border bg-panel-2 px-3 text-sm text-text focus:border-info focus:outline-none disabled:opacity-70',
          dirty ? 'border-warning' : 'border-border'
        )}
      />
    )
  }

  const inline = typeof defaultValue === 'boolean'
  return (
    <div className={clsx('grid gap-x-6 gap-y-2 py-3.5', inline ? 'grid-cols-[1fr_auto] items-center' : 'md:grid-cols-[minmax(0,1fr)_280px] md:items-center')}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
          {label}
          {dirty && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warning">
              <CircleDot className="h-3 w-3" /> {t('config.unsaved')}
            </span>
          )}
          {!dirty && overridden && (
            <Badge size="sm" variant="info">
              {t('config.overridden')}
            </Badge>
          )}
        </p>
        {help && <p className="mt-0.5 text-xs text-muted">{help}</p>}
        <p className="mt-0.5 text-[11px] text-subtle">
          {hint && <span className="mr-2 font-semibold text-muted">{t(hint.key, hint.params)}</span>}
          {!isDefault && t('config.default', { value: formatValue(defaultValue) })}
          <span className="sr-only"> ({path})</span>
        </p>
      </div>
      <div className={clsx(inline ? '' : 'w-full')}>{control}</div>
    </div>
  )
}

const SectionCard = ({ sectionKey, data, draft, onChange, readOnly, filter }) => {
  const { t, i18n } = useTranslation()
  const groups = groupFields(sectionKey, data.effective[sectionKey])
    .map((g) => ({
      ...g,
      fields: g.fields.filter(
        ({ path }) => !filter || `${path} ${fieldLabel(t, i18n, path)}`.toLowerCase().includes(filter)
      ),
    }))
    .filter((g) => g.fields.length)
  if (!groups.length) return null

  const row = ({ path, value }) => (
    <FieldRow
      key={path}
      path={path}
      value={value}
      defaultValue={getPath(data.defaults, path)}
      overridden={getPath(data.overrides, path) !== undefined}
      draft={draft[path]}
      onChange={onChange}
      readOnly={readOnly}
    />
  )

  return (
    <Card>
      <Card.Header
        title={t(`config.sections.${sectionKey}`, { defaultValue: humanize(sectionKey) })}
        subtitle={i18n.exists(`config.sectionHelp.${sectionKey}`) ? t(`config.sectionHelp.${sectionKey}`) : undefined}
        icon={<Icon3D name={SECTION_ICONS[sectionKey] ?? 'gear'} size={30} />}
      />
      {groups.map(({ group, fields }) => (
        <div key={group ?? '_'} className={clsx(group && 'mt-3 rounded-xl border border-border bg-panel-2/40 px-4')}>
          {group && (
            <p className="pt-3 text-xs font-bold uppercase tracking-wide text-muted">
              {t(`config.groups.${group}`, { defaultValue: humanize(group.split('.').at(-1)) })}
            </p>
          )}
          <div className="divide-y divide-border/70">{fields.map(row)}</div>
        </div>
      ))}
    </Card>
  )
}

/** Feature flags as switch cards. */
const FeaturesGrid = ({ data, draft, onChange, readOnly, filter }) => {
  const { t } = useTranslation()
  const keys = Object.keys(data.defaults.features).filter(
    (k) =>
      !filter ||
      `${k} ${t(`config.features.${k}.name`, { defaultValue: k })}`.toLowerCase().includes(filter)
  )
  if (!keys.length) return null
  return (
    <Card>
      <Card.Header
        title={t('config.sections.features')}
        subtitle={t('config.sectionHelp.features')}
        icon={<Icon3D name="gear" size={30} />}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map((k) => {
          const path = `features.${k}`
          const dirty = draft[path] !== undefined
          const on = dirty ? draft[path] : data.effective.features[k]
          return (
            <div
              key={k}
              className={clsx(
                'flex items-start gap-3 rounded-xl border p-4 transition-colors',
                dirty ? 'border-warning' : on ? 'border-success/40 bg-success-soft' : 'border-border bg-panel-2'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-text">{t(`config.features.${k}.name`, { defaultValue: humanize(k) })}</p>
                <p className="mt-0.5 text-xs text-muted">{t(`config.features.${k}.desc`, { defaultValue: '' })}</p>
                <p className={clsx('mt-2 text-[11px] font-semibold', on ? 'text-success' : 'text-subtle')}>
                  {on ? t('config.on') : t('config.off')}
                  {dirty && <span className="ml-2 text-warning">· {t('config.unsaved')}</span>}
                </p>
              </div>
              <Switch
                checked={on}
                disabled={readOnly}
                onChange={(v) => onChange(path, v)}
                label={t(`config.features.${k}.name`, { defaultValue: k })}
              />
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Rules-engine & platform configuration. Categories on the left, one
 * category at a time on the right; every change is collected in a draft and
 * saved as one deep-partial PATCH (validated by the backend, applied live).
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
  const [active, setActive] = useState('features')
  const [query, setQuery] = useState('')

  const categories = useMemo(() => (data ? categorize(Object.keys(data.defaults)) : []), [data])

  if (isLoading) return <PageLoader />
  if (isError || !data) return <EmptyState icon="gear" title={t('app.loadFailed')} />

  const filter = query.trim().toLowerCase()
  const dirtyCount = Object.keys(draft).length
  const dirtyIn = (sections) => Object.keys(draft).filter((p) => sections.includes(p.split('.')[0])).length
  const shown = filter ? categories : categories.filter((c) => c.key === active)

  const onChange = (path, raw) =>
    setDraft((d) => {
      const next = { ...d }
      const original = getPath(data.effective, path)
      const sample = getPath(data.defaults, path)
      if (sameValue(parseValue(raw, sample), original)) delete next[path]
      else next[path] = raw
      return next
    })

  const save = async () => {
    const parsed = Object.fromEntries(
      Object.entries(draft).map(([path, raw]) => [path, parseValue(raw, getPath(data.defaults, path))])
    )
    if (Object.values(parsed).some((v) => typeof v === 'number' && !Number.isFinite(v))) {
      dispatch(toast.error('config.invalidNumber'))
      return
    }
    try {
      await update(buildPatch(parsed)).unwrap()
      setDraft({})
      dispatch(toast.success('toast.configSaved'))
    } catch (error) {
      dispatch(toast.error(apiErrorMessage(error)))
    }
  }

  const onReset = async () => {
    const ok = await confirm({
      title: t('config.reset'),
      message: t('config.resetConfirm'),
      tone: 'warning',
      confirmLabel: t('config.reset'),
    })
    if (!ok) return
    try {
      await reset().unwrap()
      setDraft({})
      dispatch(toast.success('toast.configReset'))
    } catch (error) {
      dispatch(toast.error(apiErrorMessage(error)))
    }
  }

  return (
    <div className="space-y-4 p-5 pb-28">
      {/* Header */}
      <Card className="flex flex-wrap items-center gap-4">
        <Icon3D name="gear" size={40} />
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">{t('config.title')}</h2>
          <p className="text-xs text-muted">{t('config.subtitle')}</p>
          {!canManage && (
            <p className="mt-1 flex items-center gap-1 text-xs text-warning">
              <Lock className="h-3.5 w-3.5" /> {t('config.readOnly')}
            </p>
          )}
        </div>
        <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 focus-within:border-info sm:w-72">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('config.search')}
            aria-label={t('config.search')}
            className="h-full w-full bg-transparent text-sm text-text placeholder:text-subtle focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label={t('ui.close')} className="text-muted cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <Badge variant="neutral">{t('config.version', { version: data.version })}</Badge>
        {canManage && (
          <Button variant="outline" size="sm" loading={resetting} onClick={onReset} leftIcon={<RotateCcw className="h-4 w-4" />}>
            {t('config.reset')}
          </Button>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Category navigation */}
        <nav aria-label={t('config.categoriesLabel')} className="lg:sticky lg:top-4 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {categories.map((c) => {
              const changes = dirtyIn(c.sections)
              const selected = !filter && active === c.key
              return (
                <li key={c.key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActive(c.key)
                      setQuery('')
                    }}
                    aria-current={selected ? 'page' : undefined}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer',
                      selected ? 'border-info bg-info-soft text-text' : 'border-transparent text-muted hover:bg-panel-2 hover:text-text'
                    )}
                  >
                    <Icon3D name={c.icon} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{t(`config.categories.${c.key}.name`)}</span>
                      <span className="hidden truncate text-[11px] text-subtle lg:block">
                        {t(`config.categories.${c.key}.desc`)}
                      </span>
                    </span>
                    {changes > 0 && (
                      <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold text-bg tabular-nums">{changes}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Settings */}
        <div className="min-w-0 space-y-4">
          {shown.map((c) => (
            <section key={c.key} aria-label={t(`config.categories.${c.key}.name`)} className="space-y-4">
              {filter && (
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{t(`config.categories.${c.key}.name`)}</h3>
              )}
              {c.sections.map((key) =>
                key === 'features' ? (
                  <FeaturesGrid key={key} data={data} draft={draft} onChange={onChange} readOnly={!canManage} filter={filter} />
                ) : (
                  <SectionCard
                    key={key}
                    sectionKey={key}
                    data={data}
                    draft={draft}
                    onChange={onChange}
                    readOnly={!canManage}
                    filter={filter}
                  />
                )
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Sticky save bar */}
      {canManage && dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="region" aria-label={t('config.saveBar')}>
          <div className="flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-warning bg-panel px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)] animate-[popIn_140ms_ease-out]">
            <CircleDot className="h-5 w-5 shrink-0 text-warning" aria-hidden />
            <p className="flex-1 text-sm font-semibold text-text">{t('config.changed', { count: dirtyCount })}</p>
            <Button variant="ghost" size="sm" onClick={() => setDraft({})} leftIcon={<Undo2 className="h-4 w-4" />}>
              {t('config.discard')}
            </Button>
            <Button size="sm" loading={saving} onClick={save} leftIcon={<Save className="h-4 w-4" />}>
              {t('config.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
