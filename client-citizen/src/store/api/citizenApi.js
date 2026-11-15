import { baseApi } from './baseApi'

/**
 * Module 1 — citizen safety endpoints.
 */
export const citizenApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getZones: builder.query({
      query: () => '/citizen/zones',
      transformResponse: (data) => data?.zones ?? [],
      providesTags: ['Zones'],
    }),

    getShelters: builder.query({
      query: () => '/citizen/shelters',
      transformResponse: (data) => data?.shelters ?? [],
      providesTags: ['Shelters'],
    }),

    getRoads: builder.query({
      query: () => '/citizen/roads',
      providesTags: ['Roads'],
    }),

    // args: { lat, lng, deviceId } | { zone, deviceId }
    getEvacuationPlan: builder.query({
      query: (args) => ({ url: '/citizen/evacuation', params: args }),
      providesTags: ['Plan'],
    }),

    getCitizenState: builder.query({
      query: (deviceId) => ({ url: '/citizen/state', params: { deviceId } }),
      providesTags: ['CitizenState'],
    }),

    // { clientId, deviceId, type, lat, lng, ...optional details } — idempotent on clientId
    sendSos: builder.mutation({
      query: (body) => ({ url: '/citizen/sos', method: 'POST', body }),
      invalidatesTags: ['CitizenState'],
    }),

    // Optional follow-up answers for a live ticket
    updateSosDetails: builder.mutation({
      query: ({ clientId, ...body }) => ({ url: `/citizen/sos/${clientId}`, method: 'PATCH', body }),
      invalidatesTags: ['CitizenState'],
    }),

    updateStatus: builder.mutation({
      query: (body) => ({ url: '/citizen/status', method: 'PATCH', body }),
      invalidatesTags: ['CitizenState'],
    }),

    checkIn: builder.mutation({
      query: (deviceId) => ({ url: '/citizen/checkin', method: 'POST', body: { deviceId } }),
      invalidatesTags: ['CitizenState', 'Plan', 'Shelters'],
    }),

    createSafeShare: builder.mutation({
      query: (body) => ({ url: '/citizen/safe-share', method: 'POST', body }),
      invalidatesTags: ['CitizenState'],
    }),

    getSafeShare: builder.query({
      query: (token) => `/public/safe/${token}`,
      transformResponse: (data) => data?.share ?? null,
    }),

    getProfile: builder.query({
      query: (deviceId) => ({ url: '/citizen/profile', params: { deviceId } }),
      transformResponse: (data) => data?.profile ?? null,
      providesTags: ['Profile'],
    }),

    saveProfile: builder.mutation({
      query: (body) => ({ url: '/citizen/profile', method: 'PUT', body }),
      invalidatesTags: ['Profile'],
    }),

    deleteProfile: builder.mutation({
      query: (deviceId) => ({ url: '/citizen/profile', method: 'DELETE', params: { deviceId } }),
      invalidatesTags: ['Profile'],
    }),
  }),
})

export const {
  useGetZonesQuery,
  useGetSheltersQuery,
  useGetRoadsQuery,
  useGetEvacuationPlanQuery,
  useGetCitizenStateQuery,
  useSendSosMutation,
  useUpdateSosDetailsMutation,
  useUpdateStatusMutation,
  useCheckInMutation,
  useCreateSafeShareMutation,
  useGetSafeShareQuery,
  useGetProfileQuery,
  useSaveProfileMutation,
  useDeleteProfileMutation,
} = citizenApi
