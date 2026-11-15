import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Save, Trash2, Eye, EyeOff, Lock } from 'lucide-react'
import { Card, Button, Badge, useConfirm } from '@components'
import { useAction } from '@store/hooks'
import { useCan } from '@hooks'
import { useGetAiKeysQuery, useSetAiKeyMutation, useRemoveAiKeyMutation } from '../api'

const Row = ({ item, canManage }) => {
  const { t } = useTranslation()
  const run = useAction()
  const confirm = useConfirm()
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [save, { isLoading: saving }] = useSetAiKeyMutation()
  const [remove, { isLoading: removing }] = useRemoveAiKeyMutation()
  const isKey = item.kind === 'key'

  const onSave = async () => {
    if (await run(save({ name: item.name, value }), 'ai.keys.saved')) setValue('')
  }
  const onRemove = async () => {
    if (await confirm({ message: t('ai.keys.removeConfirm', { name: t(`ai.keys.names.${item.name}`) }), tone: 'critical', confirmLabel: t('ai.keys.remove') })) {
      run(remove(item.name), 'ai.keys.removed')
    }
  }

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text">
          {t(`ai.keys.names.${item.name}`)}
          {item.source === 'dashboard' && <Badge size="sm" variant="success">{t('ai.keys.fromDashboard')}</Badge>}
          {item.source === 'env' && <Badge size="sm" variant="info">.env</Badge>}
          {!item.source && <Badge size="sm" variant="neutral">{t('ai.keys.notSet')}</Badge>}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-subtle">{item.name}</p>
        {item.preview && <p className="mt-0.5 font-mono text-xs text-muted">{item.preview}</p>}
      </div>
      {canManage ? (
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-border bg-panel-2 focus-within:border-info">
            <input
              type={isKey && !show ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={isKey ? t('ai.keys.keyPlaceholder') : 'http://localhost:8008'}
              aria-label={t(`ai.keys.names.${item.name}`)}
              className="h-full w-full min-w-0 bg-transparent px-3 font-mono text-sm text-text placeholder:text-subtle focus:outline-none"
            />
            {isKey && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? t('ai.keys.hide') : t('ai.keys.show')}
                className="flex h-full w-10 items-center justify-center text-muted hover:text-text cursor-pointer"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
          <Button size="sm" disabled={!value.trim()} loading={saving} onClick={onSave} leftIcon={<Save className="h-4 w-4" />}>
            {t('ai.keys.save')}
          </Button>
          {item.source === 'dashboard' && (
            <Button size="sm" variant="ghost" loading={removing} onClick={onRemove} aria-label={t('ai.keys.remove')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> {t('ai.keys.readOnly')}
        </p>
      )}
    </li>
  )
}

/**
 * AI provider keys / URLs (Gemini, Claude, Whisper, local servers).
 * Stored encrypted on the server; the browser only ever sees "…last4".
 */
export const AiKeysCard = () => {
  const { t } = useTranslation()
  const canManage = useCan('config:manage')
  const { data: keys = [] } = useGetAiKeysQuery()
  return (
    <Card>
      <Card.Header title={t('ai.keys.title')} subtitle={t('ai.keys.subtitle')} icon={<KeyRound className="h-6 w-6 text-warning" />} />
      <ul className="divide-y divide-border">
        {keys.map((k) => (
          <Row key={k.name} item={k} canManage={canManage} />
        ))}
      </ul>
    </Card>
  )
}
