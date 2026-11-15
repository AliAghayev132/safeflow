import { clsx } from 'clsx'

export const Input = ({ label, error, className, id, ...props }) => (
  <label className={clsx('flex flex-col gap-1.5', className)} htmlFor={id}>
    {label && <span className="text-xs font-medium text-muted">{label}</span>}
    <input
      id={id}
      className={clsx(
        'h-11 rounded-lg bg-panel-2 border px-3 text-sm text-text placeholder:text-subtle focus:outline-none',
        error ? 'border-critical' : 'border-border focus:border-info'
      )}
      {...props}
    />
    {error && <span className="text-xs text-critical">{error}</span>}
  </label>
)
