import { useSelector } from 'react-redux'
import { useGetOverviewQuery, useGetRoadsQuery, useGetQueueQuery } from '../api/dispatcherApi'
import { useGetMeQuery } from '../api/authApi'
import { selectHydrated } from '../slices/liveSlice'
import { selectPermissions } from '../slices/authSlice'
import { hasPermission } from '@utils/permissions'

/**
 * Seeds the live slice (overview + road network + triage queue) and refreshes
 * the session's permissions. Mounted once by the dashboard layout; realtime
 * events keep the slice current afterwards.
 */
export const useLiveData = () => {
  const permissions = useSelector(selectPermissions)
  useGetMeQuery(undefined, { refetchOnMountOrArgChange: true })
  const overview = useGetOverviewQuery(undefined, {
    refetchOnMountOrArgChange: true,
    skip: !hasPermission(permissions, 'dashboard:view'),
  })
  const roads = useGetRoadsQuery(undefined, { refetchOnMountOrArgChange: true })
  useGetQueueQuery(undefined, {
    refetchOnMountOrArgChange: true,
    skip: !hasPermission(permissions, 'sos:read'),
  })
  const hydrated = useSelector(selectHydrated)

  return {
    hydrated: hydrated || !hasPermission(permissions, 'dashboard:view'),
    isError: overview.isError || roads.isError,
    refetch: () => {
      overview.refetch()
      roads.refetch()
    },
  }
}

export default useLiveData
