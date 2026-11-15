import { useSelector } from 'react-redux'

import { citizenApi } from '@store/api'
import { selectSession } from '@store/slices'

const selectZones = citizenApi.endpoints.getZones.select()

/** Best known position for AI requests: chosen point → district centre → null. */
export const useAiCoords = () => {
  const { origin, zoneCode } = useSelector(selectSession)
  const zones = useSelector((s) => selectZones(s).data)
  if (origin) return origin
  const zone = zones?.find((z) => z.code === zoneCode)
  return zone?.center ?? null
}
