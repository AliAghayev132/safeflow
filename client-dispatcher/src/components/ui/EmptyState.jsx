import { clsx } from 'clsx'
import { Icon3D } from './Icon3D'

export const EmptyState = ({ icon = 'shield', title, description, className }) => (
  <div className={clsx('flex flex-col items-center justify-center text-center py-8 px-4', className)}>
    <Icon3D name={icon} size={52} className="mb-3 opacity-90" />
    <p className="text-sm font-semibold text-text">{title}</p>
    {description && <p className="text-xs text-muted mt-1 max-w-xs">{description}</p>}
  </div>
)
