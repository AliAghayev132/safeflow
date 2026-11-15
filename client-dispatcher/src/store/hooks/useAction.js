import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { apiErrorMessage } from '../api/baseApi'
import { toast } from '../slices/uiSlice'

/**
 * Runs an RTK Query mutation trigger and reports the result as a toast.
 *   const run = useAction()
 *   run(approve(id), 'toast.alertApproved')           // translation key
 *   run(assign(...), 'toast.sosAssigned', { brigade }) // key + params
 */
export const useAction = () => {
  const dispatch = useDispatch()
  return useCallback(
    async (promise, successKey, params) => {
      try {
        const data = await promise.unwrap()
        if (successKey) dispatch(toast.success(successKey, params))
        return data ?? true
      } catch (error) {
        dispatch(toast.error(apiErrorMessage(error)))
        return null
      }
    },
    [dispatch]
  )
}

export default useAction
