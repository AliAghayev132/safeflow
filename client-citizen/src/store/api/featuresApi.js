import { baseApi } from './baseApi'

/** Runtime feature flags (backend config `features`). Cached offline too. */
export const featuresApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFeatures: builder.query({
      query: () => '/features',
      transformResponse: (data) => data?.features ?? {},
    }),
  }),
})

export const { useGetFeaturesQuery } = featuresApi
