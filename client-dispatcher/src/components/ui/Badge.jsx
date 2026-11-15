import { clsx } from 'clsx'

export const Badge = ({ children, variant = 'neutral', size = 'md', dot = false, className }) => {
  const variants = {
    neutral: 'bg-panel-3 text-muted border-border',
    critical: 'bg-critical-soft text-critical border-critical/40',
    warning: 'bg-warning-soft text-warning border-warning/40',
    success: 'bg-success-soft text-success border-success/40',
    info: 'bg-info-soft text-info border-info/40',
    solidCritical: 'bg-critical text-white border-critical',
  }
  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-0.5 text-xs',
  }
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-md border whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
