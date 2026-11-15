import { clsx } from 'clsx'

/**
 * tone: 'surface' (light grey, default) · 'plain' (white with a hairline)
 *       · 'brand' (solid blue, white text) · 'ink' (near-black, white text)
 */
export const Card = ({ children, className, padding = 'md', tone = 'surface', as: Tag = 'div', ...props }) => {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }
  const tones = {
    surface: 'bg-surface text-ink',
    plain: 'border border-line bg-canvas text-ink',
    brand: 'bg-brand text-white',
    ink: 'bg-ink text-white',
  }
  return (
    <Tag
      className={clsx('rounded-3xl', tones[tone], paddings[padding], className)}
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
