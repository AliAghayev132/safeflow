import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  type = 'button',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const variants = {
    primary: 'bg-info text-white hover:bg-[#2f6fdb]',
    critical: 'bg-critical text-white hover:bg-critical-strong',
    success: 'bg-success text-white hover:bg-[#278a5b]',
    warning: 'bg-warning text-bg hover:bg-[#dd9420]',
    secondary: 'bg-panel-3 text-text hover:bg-border-strong border border-border',
    outline: 'border border-border-strong text-text hover:bg-panel-2',
    ghost: 'text-muted hover:text-text hover:bg-panel-2',
  }

  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  }

  return (
    <button
      type={type}
      className={clsx(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        leftIcon && <span className="shrink-0 flex">{leftIcon}</span>
      )}
      {children}
      {rightIcon && <span className="shrink-0 flex">{rightIcon}</span>}
    </button>
  )
}
