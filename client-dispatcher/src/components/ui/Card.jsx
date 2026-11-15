import { clsx } from 'clsx'

export const Card = ({ children, className, padding = 'md', ...props }) => {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' }
  return (
    <section
      className={clsx('bg-panel border border-border rounded-xl', paddings[padding], className)}
      {...props}
    >
      {children}
    </section>
  )
}

const CardHeader = ({ title, subtitle, icon, actions, className }) => (
  <header className={clsx('flex items-center justify-between gap-3 mb-3', className)}>
    <div className="flex items-center gap-2.5 min-w-0">
      {icon}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-text truncate">{title}</h3>
        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
)

Card.Header = CardHeader
