import { clsx } from 'clsx'
import { Icon3D } from './Icon3D'

const tones = {
  neutral: 'border-border',
  critical: 'border-critical bg-critical-soft',
  warning: 'border-warning/60',
  success: 'border-border',
}

const valueTones = {
  neutral: 'text-text',
  critical: 'text-critical',
  warning: 'text-warning',
  success: 'text-success',
}

export const StatCard = ({ title, value, hint, icon, tone = 'neutral', className }) => (
  <div
    className={clsx(
      'bg-panel border rounded-xl px-4 py-3 flex items-center gap-3 min-w-0',
      tones[tone],
      className
    )}
  >
    {icon && <Icon3D name={icon} size={38} />}
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted truncate">{title}</p>
      <p className={clsx('text-2xl font-bold leading-tight tabular-nums', valueTones[tone])}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted truncate">{hint}</p>}
    </div>
  </div>
)
