import { useGetConfigQuery } from '@store/api/adminApi'
import { DEFAULT_THRESHOLDS } from '@constants'
import { useCan } from './useCan'

/**
 * Live operational thresholds (shelter reroute / alert, cluster params) from
 * the rules-engine config. Falls back to defaults when the user may not read
 * the config.
 */
export const useThresholds = () => {
  const allowed = useCan('config:read')
  const { data } = useGetConfigQuery(undefined, { skip: !allowed })
  const cfg = data?.effective
  return {
    reroute: cfg?.shelter?.rerouteThreshold ?? DEFAULT_THRESHOLDS.reroute,
    alert: cfg?.shelter?.alertThreshold ?? DEFAULT_THRESHOLDS.alert,
    cluster: cfg?.sosCluster ?? { minSignals: 4, windowMs: 300000, radiusMeters: 500, cooldownMs: 600000 },
    config: cfg ?? null,
  }
}

export default useThresholds
