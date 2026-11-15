/** Profile special-needs flags (backend CitizenProfile.accessibility). */
export const ACCESSIBILITY_FLAGS = ['speechImpaired', 'hearingImpaired', 'limitedMobility', 'wheelchair', 'visionImpaired']

export const emptyAccessibility = () => Object.fromEntries(ACCESSIBILITY_FLAGS.map((f) => [f, false]))

export const toAccessibility = (value) =>
  Object.fromEntries(ACCESSIBILITY_FLAGS.map((f) => [f, Boolean(value?.[f])]))
