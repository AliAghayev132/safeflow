import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { clsx } from 'clsx'
import { ArrowLeft, ArrowUp, MapPin, Droplets, Cross, Sparkles } from 'lucide-react'

import { Icon3D, Spinner } from '@components/ui'
import { selectDeviceId } from '@store/slices'
import { errorMessage } from '@utils'
import { useAiChatMutation, AI_CHAT_EVENT } from './aiApi'
import { useAiCoords } from './useAiCoords'

const CHIPS = ['shelter', 'water', 'medical', 'earthquake']
const HISTORY_LIMIT = 10

let seq = 0
const nextKey = () => `m${++seq}`

/**
 * AI assistant chat. Answers come from POST /api/ai/chat; when the server
 * says `refining`, a better answer is pushed later as an `ai:chat` realtime
 * event and replaces the bubble text.
 */
export const AssistantPage = () => {
  const { t, i18n } = useTranslation()
  const deviceId = useSelector(selectDeviceId)
  const coords = useAiCoords()
  const [chat, { isLoading }] = useAiChatMutation()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const endRef = useRef(null)

  // Refined answers pushed over the realtime channel (see applyEvent)
  useEffect(() => {
    const onRefined = (e) => {
      const { id, answer } = e.detail ?? {}
      if (!id || !answer) return
      setMessages((list) => list.map((m) => (m.id === id ? { ...m, content: answer, refining: false } : m)))
    }
    window.addEventListener(AI_CHAT_EVENT, onRefined)
    return () => window.removeEventListener(AI_CHAT_EVENT, onRefined)
  }, [])

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, isLoading])

  const ask = async (raw) => {
    const message = raw.trim()
    if (!message || isLoading) return
    const history = messages
      .filter((m) => !m.error && m.content)
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }))
    setMessages((list) => [...list, { key: nextKey(), role: 'user', content: message }])
    setText('')
    try {
      const res = await chat({
        deviceId,
        message,
        history,
        lat: coords?.lat,
        lng: coords?.lng,
        language: i18n.language,
      }).unwrap()
      setMessages((list) => [
        ...list,
        {
          key: nextKey(),
          role: 'assistant',
          id: res?.id,
          content: res?.answer ?? '',
          sources: res?.sources ?? [],
          mock: Boolean(res?.mock),
          refining: Boolean(res?.refining),
        },
      ])
    } catch (error) {
      setMessages((list) => [...list, { key: nextKey(), role: 'assistant', error: true, content: errorMessage(error) }])
    }
  }

  const submit = (e) => {
    e.preventDefault()
    ask(text)
  }

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <Link
          to="/"
          aria-label={t('assistant.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-transform hover:bg-surface-strong active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">{t('assistant.title')}</h1>
          <p className="truncate text-xs font-medium text-muted">{t('assistant.subtitle')}</p>
        </div>
      </div>

      <div className="flex-1 space-y-3" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && (
          <div className="pop-in rounded-3xl bg-surface p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-canvas">
                <Icon3D name="megaphone" size={30} />
              </span>
              <p className="text-sm font-semibold text-ink">{t('assistant.intro')}</p>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.key} message={m} />
        ))}

        {isLoading && (
          <div className="pop-in flex w-fit items-center gap-2 rounded-3xl rounded-bl-lg bg-surface px-4 py-3 text-sm font-medium text-muted">
            <Spinner className="h-4 w-4 text-brand" /> {t('assistant.thinking')}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-24 mt-4 space-y-2 bg-canvas pt-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t('assistant.quick')}>
          {CHIPS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={isLoading}
              onClick={() => ask(t(`assistant.chips.${key}.question`))}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-ink transition-transform hover:bg-surface-strong active:scale-95 disabled:opacity-60"
            >
              <ChipIcon name={key} />
              {t(`assistant.chips.${key}.label`)}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-surface p-1.5">
          <label htmlFor="assistant-input" className="sr-only">
            {t('assistant.placeholder')}
          </label>
          <input
            id="assistant-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            autoComplete="off"
            placeholder={t('assistant.placeholder')}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || isLoading}
            aria-label={t('assistant.send')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform hover:bg-ink-soft active:scale-90 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  )
}

const ChipIcon = ({ name }) => {
  const cls = 'h-4 w-4 shrink-0'
  if (name === 'shelter') return <MapPin className={clsx(cls, 'text-brand')} aria-hidden />
  if (name === 'water') return <Droplets className={clsx(cls, 'text-brand')} aria-hidden />
  if (name === 'medical') return <Cross className={clsx(cls, 'text-sos')} aria-hidden />
  return <Sparkles className={clsx(cls, 'text-warn')} aria-hidden />
}

const Bubble = ({ message: m }) => {
  const { t } = useTranslation()
  const mine = m.role === 'user'
  return (
    <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={clsx('pop-in max-w-[85%] space-y-2', mine && 'pop-in-right')}>
        <div
          className={clsx(
            'whitespace-pre-line rounded-3xl px-4 py-3 text-sm font-medium leading-relaxed',
            mine && 'rounded-br-lg bg-ink text-white',
            !mine && !m.error && 'rounded-bl-lg bg-surface text-ink',
            m.error && 'rounded-bl-lg bg-sos-soft text-sos'
          )}
        >
          {m.content}
        </div>
        {!mine && (m.refining || m.mock) && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {m.refining && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                <Spinner className="h-3 w-3 text-brand" /> {t('assistant.refining')}
              </span>
            )}
            {m.mock && (
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warn">
                {t('assistant.demo')}
              </span>
            )}
          </div>
        )}
        {!mine && m.sources?.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('assistant.sources')}>
            {m.sources.map((s) => (
              <li
                key={s.id ?? s.name}
                className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand"
              >
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="max-w-40 truncate">{s.name}</span>
                {s.distance && <span>· {s.distance}</span>}
                {s.pct != null && <span>· {s.pct}%</span>}
                {s.medicalPoint && <Cross className="h-3 w-3 text-sos" aria-hidden />}
                {s.water && <Droplets className="h-3 w-3" aria-hidden />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
