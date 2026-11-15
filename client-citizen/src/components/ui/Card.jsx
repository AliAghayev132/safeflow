import { clsx } from 'clsx'

export const Card = ({ children, className, padding = 'md', as: Tag = 'div', ...props }) => {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }
  return (
    <Tag
      className={clsx('rounded-2xl border border-line bg-surface', paddings[padding], className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

const CardTitle = ({ children, className }) => (
  <h2 className={clsx('text-base font-bold text-ink', className)}>{children}</h2>
)

const CardDescription = ({ children, className }) => (
  <p className={clsx('mt-0.5 text-sm text-muted', className)}>{children}</p>
)

Card.Title = CardTitle
Card.Description = CardDescription
