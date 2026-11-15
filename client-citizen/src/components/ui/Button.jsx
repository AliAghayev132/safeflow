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
    // Black pill — the main action on a screen
    primary: 'bg-ink text-white hover:bg-ink-soft focus-visible:ring-ink',
    brand: 'bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand',
    sos: 'bg-sos text-white hover:bg-sos-hover focus-visible:ring-sos',
    safe: 'bg-safe text-white hover:bg-safe-hover focus-visible:ring-safe',
    outline: 'bg-surface text-ink hover:bg-surface-strong focus-visible:ring-ink',
    light: 'bg-canvas text-ink hover:bg-surface focus-visible:ring-ink',
    ghost: 'text-ink-soft hover:bg-surface focus-visible:ring-ink',
  }

  const sizes = {
    sm: 'h-12 px-4 text-sm gap-1.5 rounded-full',
    md: 'h-12 px-5 text-sm gap-2 rounded-full',
    lg: 'h-14 px-6 text-base gap-2.5 rounded-full',
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
