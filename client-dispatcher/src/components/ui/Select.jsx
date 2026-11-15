import { clsx } from 'clsx'

export const Select = ({ label, options = [], className, id, ...props }) => (
  <label className={clsx('flex flex-col gap-1.5', className)} htmlFor={id}>
    {label && <span className="text-xs font-medium text-muted">{label}</span>}
    <select
      id={id}
      className="h-10 rounded-lg bg-panel-2 border border-border px-3 text-sm text-text focus:outline-none focus:border-info"
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
)
