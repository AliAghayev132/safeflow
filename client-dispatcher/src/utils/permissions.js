/**
 * Mirrors backend/engine/permissions.js. The backend is the authority — this
 * only decides what to SHOW (menu entries, pages, buttons).
 *   `sos:*` matches `sos:read`; `*` matches everything.
 */
export const hasPermission = (granted = [], required) => {
  if (!required) return true
  return granted.some((p) => {
    if (p === '*' || p === required) return true
    if (p.endsWith(':*')) return required.startsWith(p.slice(0, -1))
    return false
  })
}

/** True when the user has ANY of the permissions (array) or the single one. */
export const can = (granted, required) =>
  Array.isArray(required)
    ? required.length === 0 || required.some((r) => hasPermission(granted, r))
    : hasPermission(granted, required)
