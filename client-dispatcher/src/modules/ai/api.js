import { baseApi, API_ORIGIN } from '@store/api/baseApi'

/** AI module endpoints (/api/ai/*, one feature flag per capability). */
export const aiApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['AiForecast', 'AiDamage', 'AiPlan', 'AiStatus'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getAiStatus: builder.query({
        query: () => '/ai/status',
        transformResponse: (res) => res.data,
        providesTags: ['AiStatus'],
      }),
      getForecast: builder.query({
        query: () => '/ai/forecast',
        transformResponse: (res) => res.data.forecast,
        providesTags: ['AiForecast'],
      }),
      refreshForecast: builder.mutation({
        query: () => ({ url: '/ai/forecast/refresh', method: 'POST' }),
        invalidatesTags: ['AiForecast', 'AiPlan'],
      }),
      getDamage: builder.query({
        query: () => '/ai/damage',
        transformResponse: (res) => res.data.assessments,
        providesTags: ['AiDamage'],
      }),
      // Raw image upload (not JSON): body = File / Blob
      assessImage: builder.mutation({
        query: ({ file, lat, lng, source = 'operator' }) => ({
          url: `/ai/damage/assess?lat=${lat}&lng=${lng}&source=${source}`,
          method: 'POST',
          body: file,
          headers: { 'Content-Type': file.type },
        }),
        invalidatesTags: ['AiDamage'],
      }),
      droneSurvey: builder.mutation({
        query: (body) => ({ url: '/ai/damage/survey', method: 'POST', body }),
        invalidatesTags: ['AiDamage'],
      }),
      revertDamage: builder.mutation({
        query: (id) => ({ url: `/ai/damage/${id}/revert`, method: 'POST' }),
        invalidatesTags: ['AiDamage'],
      }),
      getSupplyPlan: builder.query({
        query: () => '/ai/supply/plan',
        transformResponse: (res) => res.data.plan,
        providesTags: ['AiPlan'],
      }),
      refreshSupplyPlan: builder.mutation({
        query: () => ({ url: '/ai/supply/plan/refresh', method: 'POST' }),
        invalidatesTags: ['AiPlan', 'AiForecast'],
      }),
      applySupplyPlan: builder.mutation({
        query: (shelterIds) => ({ url: '/ai/supply/plan/apply', method: 'POST', body: { shelterIds } }),
        invalidatesTags: ['AiPlan', 'Supplies'],
      }),
    }),
  })

export const {
  useGetAiStatusQuery,
  useGetForecastQuery,
  useRefreshForecastMutation,
  useGetDamageQuery,
  useAssessImageMutation,
  useDroneSurveyMutation,
  useRevertDamageMutation,
  useGetSupplyPlanQuery,
  useRefreshSupplyPlanMutation,
  useApplySupplyPlanMutation,
} = aiApi

export { API_ORIGIN }
