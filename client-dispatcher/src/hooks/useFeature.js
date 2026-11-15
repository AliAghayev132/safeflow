import { useGetFeaturesQuery } from '@store/api'

/** All runtime feature flags ({} while loading — features stay hidden). */
export const useFeatures = () => {
  const { data } = useGetFeaturesQuery()
  return data ?? {}
}

/** true when the backend feature flag is on. */
export const useFeature = (name) => useFeatures()[name] === true
