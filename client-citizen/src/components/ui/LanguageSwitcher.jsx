import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import { Check, Languages } from 'lucide-react'
import { LANGUAGES, setLanguage } from '@/i18n'

/**
 * Compact language menu (AZ / EN / RU) — a pill button with a small custom
 * menu (no native <select>). The choice is persisted.
 */
export const LanguageSwitcher = ({ className }) => {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const current = LANGUAGES.includes(i18n.language) ? i18n.language : LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !root.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('common.language')}: ${t(`lang.${current}Name`)}`}
        className="flex h-12 items-center gap-1.5 rounded-full bg-surface px-3.5 text-xs font-extrabold text-ink transition-colors hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Languages className="h-4 w-4" aria-hidden />
        {t(`lang.${current}`)}
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={t('common.language')}
          className="absolute right-0 top-full z-[600] mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-canvas p-1.5 shadow-[0_12px_32px_rgba(13,15,20,0.16)]"
        >
          {LANGUAGES.map((lng) => (
            <li key={lng} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={current === lng}
                onClick={() => {
                  setLanguage(lng)
                  setOpen(false)
                }}
                className={clsx(
                  'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors',
                  current === lng ? 'bg-ink text-white' : 'text-ink hover:bg-surface'
                )}
              >
                <span className="w-7 text-xs font-extrabold">{t(`lang.${lng}`)}</span>
                <span className="flex-1">{t(`lang.${lng}Name`)}</span>
                {current === lng && <Check className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
