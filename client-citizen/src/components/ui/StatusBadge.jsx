import { clsx } from 'clsx'
import {
  AlertTriangle,
  Check,
  Clock,
  Footprints,
  HelpCircle,
  Hourglass,
  ShieldCheck,
  Truck,
  WifiOff,
  Radio,
  RefreshCw,
  Flame,
} from 'lucide-react'

const ICONS = {
  alert: AlertTriangle,
  check: Check,
  clock: Clock,
  walk: Footprints,
  help: HelpCircle,
  hourglass: Hourglass,
  shield: ShieldCheck,
  truck: Truck,
  offline: WifiOff,
  live: Radio,
  polling: RefreshCw,
  fast: Flame,
}

const TONES = {
  neutral: 'bg-canvas text-ink-soft border-line-strong',
  brand: 'bg-brand-soft text-brand border-brand/30',
  ok: 'bg-safe-soft text-safe border-safe/30',
  busy: 'bg-warn-soft text-warn border-warn/30',
  full: 'bg-full-soft text-full border-full/30',
  sos: 'bg-sos-soft text-sos border-sos/30',
  info: 'bg-info-soft text-info border-info/30',
}

/**
 * Status = icon + text + colour (never colour alone — readable for
 * colour-blind users).
 */
export const StatusBadge = ({ tone = 'neutral', icon, children, size = 'md', className }) => {
  const Icon = ICONS[icon]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border font-bold',
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs',
        TONES[tone],
        className
      )}
    >
      {Icon && <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />}
      {children}
    </span>
  )
}
