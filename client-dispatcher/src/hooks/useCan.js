import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectPermissions } from '@store/slices/authSlice'
import { can } from '@utils/permissions'

/**
 * Permission check for the UI (menus, pages, buttons). The backend enforces
 * the same permissions on REST and WebSocket channels.
 *   const canAssign = useCan('sos:assign')
 *   const check = useCan(); check(['brigade:update', 'brigade:update_own'])
 */
export const useCan = (required) => {
  const permissions = useSelector(selectPermissions)
  const check = useCallback((r) => can(permissions, r), [permissions])
  return required === undefined ? check : check(required)
}

export default useCan
