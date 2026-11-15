import { useGetFeaturesQuery } from '@store/api'

/** All runtime feature flags ({} while loading). */
export const useFeatures = () => useGetFeaturesQuery().data ?? {}

/** true when the backend feature flag is on. */
export const useFeature = (name) => useFeatures()[name] === true
