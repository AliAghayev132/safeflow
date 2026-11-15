/**
 * Distinct vibration confirmations, so the outcome is clear without looking
 * at (or hearing) the screen:
 *   sent / duplicate → short · short · long
 *   queued           → long · long
 *   failed / error   → one very long
 */
export const VIBRATION = {
  sent: [120, 80, 120, 80, 400],
  duplicate: [120, 80, 120, 80, 400],
  queued: [500, 250, 500],
  error: [1200],
}

export const vibrateOutcome = (status) => {
  const pattern = VIBRATION[status]
  if (!pattern) return false
  try {
    return navigator.vibrate?.(pattern) ?? false
  } catch {
    return false
  }
}
