import { clsx } from 'clsx'

export const Badge = ({ children, tone = 'neutral', className }) => {
  const tones = {
    neutral: 'bg-canvas text-ink-soft',
    dark: 'bg-ink text-white',
    brand: 'bg-brand-soft text-brand',
    ok: 'bg-safe-soft text-safe',
    busy: 'bg-warn-soft text-warn',
    full: 'bg-full-soft text-full',
    sos: 'bg-sos-soft text-sos',
    info: 'bg-info-soft text-info',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
