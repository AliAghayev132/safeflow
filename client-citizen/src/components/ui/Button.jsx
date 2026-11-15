import { clsx } from 'clsx'
import { Spinner } from './Spinner'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className,
  type = 'button',
  ...props
}) => {
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand',
    sos: 'bg-sos text-white hover:bg-sos-hover focus-visible:ring-sos',
    safe: 'bg-safe text-white hover:bg-safe-hover focus-visible:ring-safe',
    outline:
      'border border-line-strong bg-surface text-ink hover:bg-canvas focus-visible:ring-brand',
    ghost: 'text-ink-soft hover:bg-canvas focus-visible:ring-brand',
  }

  const sizes = {
    sm: 'h-12 px-3 text-sm gap-1.5 rounded-lg',
    md: 'h-12 px-4 text-sm gap-2 rounded-xl',
    lg: 'h-14 px-5 text-base gap-2.5 rounded-xl',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
