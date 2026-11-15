import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { Copy, Share2 } from 'lucide-react'

import { Button, Icon3D } from '@components/ui'
import { useCreateSafeShareMutation, useGetProfileQuery, useUpdateStatusMutation } from '@store/api'
import { selectSession, clearTicket } from '@store/slices'
import { formatDateTime, errorMessage } from '@utils'

/**
 * "I'm safe": one tap marks the citizen safe (their SOS leave cluster
 * counting on the server) and produces a share link for family members.
 * Offline: the status update is retried later; the link needs a connection.
 */
export const SafeShareButton = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { deviceId, origin } = useSelector(selectSession)
  const { data: profile } = useGetProfileQuery(deviceId)
  const [createShare, { isLoading }] = useCreateSafeShareMutation()
  const [updateStatus] = useUpdateStatusMutation()
  const [share, setShare] = useState(null)
  const [message, setMessage] = useState(null)

  const handle = async () => {
    setMessage(null)
    try {
      const res = await createShare({
        deviceId,
        displayName: profile?.fullName ?? '',
        ...(origin ?? {}),
      }).unwrap()
      dispatch(clearTicket())
      setShare(res.share)
      const text = t('safe.shareText', {
        name: profile?.fullName || t('safe.anonymous'),
        time: formatDateTime(res.share.at),
      })
      if (navigator.share) {
        await navigator.share({ title: t('safe.shareTitle'), text, url: res.share.url }).catch(() => null)
      }
      setMessage({ tone: 'ok', text: t('safe.marked') })
    } catch (error) {
      // Offline: at least try the status update (fails silently if offline)
      updateStatus({ deviceId, status: 'safe', ...(origin ?? {}) })
      setMessage({ tone: 'error', text: errorMessage(error) })
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.url)
      setMessage({ tone: 'ok', text: t('safe.copied') })
    } catch {
      setMessage({ tone: 'ok', text: share.url })
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <Button variant="safe" size="lg" fullWidth loading={isLoading} onClick={handle} className="min-h-14 text-base">
        <Icon3D name="safe" size={26} />
        {t('sos.safe')}
      </Button>
      <p className="mt-1.5 text-center text-xs font-medium text-muted">{t('sos.safeHint')}</p>

      {share && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-safe-soft p-2">
          <Share2 className="h-4 w-4 shrink-0 text-safe" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-safe">{share.url}</span>
          <Button size="sm" variant="outline" onClick={copy} leftIcon={<Copy className="h-3.5 w-3.5" />}>
            {t('safe.copy')}
          </Button>
        </div>
      )}
      {message && (
        <p
          role="status"
          className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold ${message.tone === 'ok' ? 'bg-safe-soft text-safe' : 'bg-sos-soft text-sos'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
