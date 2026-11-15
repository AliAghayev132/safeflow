import { SHELTER_FULL_RATE } from '@constants'

/**
 * Occupancy level → semantic tone used by bars, badges and map markers.
 *   < 70%  ok      (green)
 *   70–90% busy    (amber)
 *   >= 90% full    (orange-red) — citizens are rerouted away
 * Always rendered with an icon + text label, never colour alone.
 */
export const occupancyTone = (rate = 0) => {
  if (rate >= SHELTER_FULL_RATE) return 'full'
  if (rate >= 0.7) return 'busy'
  return 'ok'
}

export const occupancyColors = {
  ok: { bar: 'bg-safe', text: 'text-safe', soft: 'bg-safe-soft', hex: '#137837' },
  busy: { bar: 'bg-warn', text: 'text-warn', soft: 'bg-warn-soft', hex: '#b45309' },
  full: { bar: 'bg-full', text: 'text-full', soft: 'bg-full-soft', hex: '#c2410c' },
}

/** Translation key for the level label (`shelters.level.*`). */
export const occupancyLabelKey = (rate = 0) => `shelters.level.${occupancyTone(rate)}`
