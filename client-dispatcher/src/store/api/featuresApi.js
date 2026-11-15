import { baseApi } from './baseApi'

/**
 * Runtime feature flags (backend config section `features`). Disabled
 * features disappear from the menu and their pages are not routed.
 * Refetched when the config changes (config:updated → 'Features' tag).
 */
export const featuresApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFeatures: builder.query({
      query: () => '/features',
      transformResponse: (res) => res?.data?.features ?? res?.features ?? {},
      providesTags: ['Features'],
    }),
  }),
})

export const { useGetFeaturesQuery } = featuresApi
