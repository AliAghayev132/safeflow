import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Contrast } from 'lucide-react'
import { clsx } from 'clsx'

import { isHighContrast, readContrast, setContrast } from '../contrast'

/** Header toggle for high-contrast mode (persisted; default follows the OS). */
export const ContrastToggle = ({ className }) => {
  const { t } = useTranslation()
  const [on, setOn] = useState(() => isHighContrast(readContrast()))

  const toggle = () => {
    const next = !on
    setContrast(next ? 'on' : 'off')
    setOn(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={t('a11y.contrast.toggle')}
      title={on ? t('a11y.contrast.on') : t('a11y.contrast.off')}
      className={clsx(
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 transition-colors',
        on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink hover:bg-canvas',
        className
      )}
    >
      <Contrast className="h-5 w-5" aria-hidden />
    </button>
  )
}
