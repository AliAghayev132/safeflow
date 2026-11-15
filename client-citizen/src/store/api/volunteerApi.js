import { baseApi, API_ORIGIN } from './baseApi'

/**
 * Volunteers module (feature flag `volunteers`) — device-scoped endpoints.
 * Module tag types are added with enhanceEndpoints (shared baseApi untouched).
 */
export const volunteerApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Volunteer', 'VolunteerRequests'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getVolunteer: builder.query({
        query: (deviceId) => ({ url: '/volunteers/me', params: { deviceId } }),
        transformResponse: (data) => data?.profile ?? null,
        providesTags: ['Volunteer'],
      }),
      saveVolunteer: builder.mutation({
        query: (body) => ({ url: '/volunteers/me', method: 'PUT', body }),
        invalidatesTags: ['Volunteer', 'VolunteerRequests'],
      }),
      withdrawVolunteer: builder.mutation({
        query: (deviceId) => ({ url: '/volunteers/me/withdraw', method: 'POST', body: { deviceId } }),
        invalidatesTags: ['Volunteer', 'VolunteerRequests'],
      }),
      setVolunteerAvailability: builder.mutation({
        query: ({ deviceId, availability }) => ({
          url: '/volunteers/me/availability',
          method: 'PATCH',
          body: { deviceId, availability },
        }),
        invalidatesTags: ['Volunteer'],
      }),
      updateVolunteerLocation: builder.mutation({
        query: (body) => ({ url: '/volunteers/me/location', method: 'POST', body }),
        invalidatesTags: ['Volunteer'],
      }),
      getVolunteerRequests: builder.query({
        query: (deviceId) => ({ url: '/volunteers/me/requests', params: { deviceId } }),
        transformResponse: (data) => data?.requests ?? [],
        providesTags: ['VolunteerRequests'],
      }),
      acceptVolunteerRequest: builder.mutation({
        query: ({ id, deviceId }) => ({ url: `/volunteers/requests/${id}/accept`, method: 'POST', body: { deviceId } }),
        invalidatesTags: ['VolunteerRequests'],
      }),
      declineVolunteerRequest: builder.mutation({
        query: ({ id, deviceId }) => ({ url: `/volunteers/requests/${id}/decline`, method: 'POST', body: { deviceId } }),
        invalidatesTags: ['VolunteerRequests'],
      }),
      // Raw-body upload (PDF / PNG / JPEG) — not JSON, so a custom queryFn
      uploadVolunteerDocument: builder.mutation({
        queryFn: async ({ deviceId, file }) => {
          try {
            const params = new URLSearchParams({ deviceId, name: file.name })
            const res = await fetch(`${API_ORIGIN}/api/volunteers/me/documents?${params}`, {
              method: 'POST',
              headers: { 'Content-Type': file.type || 'application/octet-stream' },
              body: file,
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) return { error: { status: res.status, code: body.code, message: body.message } }
            return { data: body.data }
          } catch {
            return { error: { status: 'FETCH_ERROR', code: 'FETCH_ERROR' } }
          }
        },
        invalidatesTags: ['Volunteer'],
      }),
    }),
  })

export const {
  useGetVolunteerQuery,
  useSaveVolunteerMutation,
  useWithdrawVolunteerMutation,
  useSetVolunteerAvailabilityMutation,
  useUpdateVolunteerLocationMutation,
  useGetVolunteerRequestsQuery,
  useAcceptVolunteerRequestMutation,
  useDeclineVolunteerRequestMutation,
  useUploadVolunteerDocumentMutation,
} = volunteerApi
