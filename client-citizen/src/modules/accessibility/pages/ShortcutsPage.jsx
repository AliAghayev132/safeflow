import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { Copy, Check, KeyRound, Trash2, ExternalLink } from 'lucide-react'

import { Button, Card, Icon3D } from '@components/ui'
import { selectDeviceId, selectIsOffline } from '@store/slices'
import { errorMessage, formatDateTime } from '@utils'
import {
  SHORTCUT_SOS_URL,
  useGetShortcutTokenQuery,
  useIssueShortcutTokenMutation,
  useRevokeShortcutTokenMutation,
} from '../a11yApi'

const CopyField = ({ id, label, value }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </label>
      <div className="flex gap-2">
        <textarea
          id={id}
          readOnly
          rows={Math.min(6, value.split('\n').length)}
          value={value}
          className="min-h-12 w-full resize-none rounded-xl border-2 border-line-strong bg-canvas px-3 py-2 font-mono text-xs text-ink"
        />
        <button
          type="button"
          onClick={copy}
          aria-label={`${t('a11y.shortcuts.copy')}: ${label}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line-strong bg-surface text-ink hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {copied ? <Check className="h-5 w-5 text-safe" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? t('a11y.shortcuts.copied') : ''}
      </span>
    </div>
  )
}

const Steps = ({ title, steps, note, icon }) => (
  <Card className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon3D name={icon} size={30} />
      <h2 className="text-base font-extrabold text-ink">{title}</h2>
    </div>
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
      {steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
    {note && <p className="rounded-lg bg-info-soft px-3 py-2 text-xs font-semibold text-info">{note}</p>}
  </Card>
)

/**
 * One-tap / voice SOS setup: home-screen shortcut, personal token, the exact
 * request for Siri Shortcuts and Android automation apps.
 */
export const ShortcutsPage = () => {
  const { t } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const offline = useSelector(selectIsOffline)
  const { data: status } = useGetShortcutTokenQuery(deviceId)
  const [issue, { isLoading: issuing }] = useIssueShortcutTokenMutation()
  const [revoke, { isLoading: revoking }] = useRevokeShortcutTokenMutation()
  const [fresh, setFresh] = useState(null) // shown once, never stored
  const [feedback, setFeedback] = useState(null)

  const onIssue = async () => {
    setFeedback(null)
    try {
      const res = await issue(deviceId).unwrap()
      setFresh(res.token)
    } catch (error) {
      setFeedback({ ok: false, text: errorMessage(error) })
    }
  }

  const onRevoke = async () => {
    setFeedback(null)
    try {
      await revoke(deviceId).unwrap()
      setFresh(null)
      setFeedback({ ok: true, text: t('a11y.shortcuts.revoked') })
    } catch (error) {
      setFeedback({ ok: false, text: errorMessage(error) })
    }
  }

  const token = fresh ?? `<${t('a11y.shortcuts.tokenPlaceholder')}>`
  const headers = `Authorization: Bearer ${token}\nContent-Type: application/json\nIdempotency-Key: <${t('a11y.shortcuts.idempotencyPlaceholder')}>`
  const body = JSON.stringify({ type: 'general', lat: 40.4093, lng: 49.8671 }, null, 2)
  const quickUrl = `${window.location.origin}/quick-sos`

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center gap-3">
        <Icon3D name="phone" size={44} />
        <div>
          <h1 className="text-xl font-extrabold text-ink">{t('a11y.shortcuts.title')}</h1>
          <p className="text-sm text-muted">{t('a11y.shortcuts.intro')}</p>
        </div>
      </div>

      <Steps title={t('a11y.shortcuts.homeTitle')} steps={t('a11y.shortcuts.homeSteps', { returnObjects: true })} icon="sos" />
      <Card className="space-y-3">
        <CopyField id="quick-url" label={t('a11y.shortcuts.quickUrl')} value={quickUrl} />
        <Link
          to="/quick-sos"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sos px-4 text-sm font-bold text-white hover:bg-sos-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sos focus-visible:ring-offset-2"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {t('a11y.shortcuts.openQuick')}
        </Link>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" aria-hidden />
          <h2 className="text-base font-extrabold text-ink">{t('a11y.shortcuts.tokenTitle')}</h2>
        </div>
        <p className="text-sm text-ink-soft">{t('a11y.shortcuts.tokenIntro')}</p>
        <p className="text-xs font-semibold text-muted" aria-live="polite">
          {status?.active
            ? t('a11y.shortcuts.tokenActive', { prefix: status.prefix, date: formatDateTime(status.createdAt) })
            : t('a11y.shortcuts.tokenNone')}
          {status?.active && status.lastUsedAt && ` · ${t('a11y.shortcuts.tokenLastUsed', { date: formatDateTime(status.lastUsedAt) })}`}
        </p>

        {fresh && (
          <div className="rounded-xl border-2 border-warn bg-warn-soft p-3">
            <p className="mb-2 text-xs font-bold text-warn">{t('a11y.shortcuts.shownOnce')}</p>
            <CopyField id="token" label={t('a11y.shortcuts.tokenTitle')} value={fresh} />
          </div>
        )}

        {offline && <p className="text-xs font-semibold text-warn">{t('a11y.shortcuts.offline')}</p>}
        {feedback && (
          <p role="status" className={`rounded-lg px-3 py-2 text-xs font-semibold ${feedback.ok ? 'bg-safe-soft text-safe' : 'bg-sos-soft text-sos'}`}>
            {feedback.text}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={onIssue} loading={issuing} disabled={offline} leftIcon={<KeyRound className="h-4 w-4" aria-hidden />}>
            {status?.active ? t('a11y.shortcuts.rotate') : t('a11y.shortcuts.create')}
          </Button>
          {status?.active && (
            <Button variant="outline" onClick={onRevoke} loading={revoking} disabled={offline} leftIcon={<Trash2 className="h-4 w-4" aria-hidden />}>
              {t('a11y.shortcuts.revoke')}
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-extrabold text-ink">{t('a11y.shortcuts.requestTitle')}</h2>
        <CopyField id="req-method" label={t('a11y.shortcuts.method')} value="POST" />
        <CopyField id="req-url" label={t('a11y.shortcuts.url')} value={SHORTCUT_SOS_URL} />
        <CopyField id="req-headers" label={t('a11y.shortcuts.headers')} value={headers} />
        <CopyField id="req-body" label={t('a11y.shortcuts.body')} value={body} />
        <p className="text-xs text-muted">{t('a11y.shortcuts.bodyHint')}</p>
      </Card>

      <Steps
        title={t('a11y.shortcuts.iosTitle')}
        steps={t('a11y.shortcuts.iosSteps', { returnObjects: true })}
        note={t('a11y.shortcuts.iosNote')}
        icon="phone"
      />
      <Steps
        title={t('a11y.shortcuts.androidTitle')}
        steps={t('a11y.shortcuts.androidSteps', { returnObjects: true })}
        note={t('a11y.shortcuts.androidNote')}
        icon="megaphone"
      />
    </div>
  )
}
