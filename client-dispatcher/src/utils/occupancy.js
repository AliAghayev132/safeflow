import { OCCUPANCY_COLORS, COLORS } from '@constants'

/** Bar / marker colour for an occupancy rate 0..1. */
export const occupancyColor = (rate = 0) =>
  (OCCUPANCY_COLORS.find((level) => rate < level.max) ?? OCCUPANCY_COLORS.at(-1)).color

/**
 * Shelter level key (`shelterLevel.*`) — server `level` when present, else
 * derived from the thresholds. Inactive reserves get their own key.
 */
export const shelterLevelKey = (shelter, thresholds) => {
  if (!shelter.isActive) return 'inactive'
  if (shelter.level) return shelter.level
  if (shelter.occupancyRate >= thresholds.alert) return 'critical'
  if (shelter.occupancyRate >= thresholds.reroute) return 'warning'
  return 'normal'
}

/** Colour for a zone by active SOS load. */
export const zoneLoadColor = (sosActive = 0) => {
  if (sosActive >= 4) return COLORS.critical
  if (sosActive >= 2) return COLORS.orange
  if (sosActive >= 1) return COLORS.warning
  return COLORS.success
}
