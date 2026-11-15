import { clsx } from 'clsx'
import { Icon3D } from './Icon3D'

export const EmptyState = ({ icon = 'map', title, description, action, className }) => (
  <div className={clsx('flex flex-col items-center px-4 py-8 text-center', className)}>
    <Icon3D name={icon} size={56} />
    <p className="mt-3 font-bold text-ink">{title}</p>
    {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
)
