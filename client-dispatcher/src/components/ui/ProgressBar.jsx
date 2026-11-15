import { clsx } from 'clsx'

/** Solid-colour horizontal bar. `value` is 0..1. */
export const ProgressBar = ({ value = 0, color = '#3B82F6', height = 6, className, marker }) => (
  <div
    className={clsx('relative w-full rounded-full bg-panel-3 overflow-hidden', className)}
    style={{ height }}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(value * 100)}
  >
    <div
      className="h-full rounded-full transition-[width] duration-500"
      style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }}
    />
    {marker !== undefined && (
      <span
        className="absolute top-0 bottom-0 w-px bg-text/60"
        style={{ left: `${marker * 100}%` }}
      />
    )}
  </div>
)
