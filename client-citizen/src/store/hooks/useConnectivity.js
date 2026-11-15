import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

import { baseApi, ALL_TAGS } from '@store/api'
import { setOnline } from '@store/slices/networkSlice'

/**
 * Tracks browser online/offline. When the connection returns, every cached
 * query is refetched so the offline snapshot is refreshed automatically.
 */
export const useConnectivity = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    const online = () => {
      dispatch(setOnline(true))
      dispatch(baseApi.util.invalidateTags(ALL_TAGS))
    }
    const offline = () => dispatch(setOnline(false))
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [dispatch])
}
