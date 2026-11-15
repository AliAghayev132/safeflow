import { clsx } from 'clsx'

export const Spinner = ({ className, label }) => (
  <span
    role="status"
    aria-label={label}
    className={clsx(
      'inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent',
      className
    )}
  />
)
