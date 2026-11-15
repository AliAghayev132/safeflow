import { baseApi, API_ORIGIN } from './baseApi'

/**
 * Volunteers module (feature flag `volunteers`). Module-owned tag types are
 * added with enhanceEndpoints so the shared baseApi stays untouched.
 */
export const volunteerApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Volunteers', 'VolunteerRequests', 'VolunteerVerification'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getVolunteers: builder.query({
        query: (params = {}) => ({ url: '/volunteers', params }),
        transformResponse: (res) => res.data.volunteers,
        providesTags: ['Volunteers'],
      }),
      getVolunteerRequests: builder.query({
        query: (params = {}) => ({ url: '/volunteers/requests', params }),
        transformResponse: (res) => res.data.requests,
        providesTags: ['VolunteerRequests'],
      }),
      createVolunteerRequest: builder.mutation({
        query: (body) => ({ url: '/volunteers/requests', method: 'POST', body }),
        invalidatesTags: ['VolunteerRequests'],
      }),
      cancelVolunteerRequest: builder.mutation({
        query: (id) => ({ url: `/volunteers/requests/${id}/cancel`, method: 'POST' }),
        invalidatesTags: ['VolunteerRequests'],
      }),
      notifyMedicalVolunteers: builder.mutation({
        query: (sosId) => ({ url: `/volunteers/medical-sos/${sosId}`, method: 'POST' }),
        invalidatesTags: ['VolunteerRequests'],
      }),
      getVerificationQueue: builder.query({
        query: () => '/volunteers/verification',
        transformResponse: (res) => res.data.volunteers,
        providesTags: ['VolunteerVerification'],
      }),
      verifyVolunteer: builder.mutation({
        query: ({ id, decision, note }) => ({
          url: `/volunteers/${id}/verify`,
          method: 'POST',
          body: { decision, note },
        }),
        invalidatesTags: ['VolunteerVerification', 'Volunteers'],
      }),
    }),
  })

export const {
  useGetVolunteersQuery,
  useGetVolunteerRequestsQuery,
  useCreateVolunteerRequestMutation,
  useCancelVolunteerRequestMutation,
  useNotifyMedicalVolunteersMutation,
  useGetVerificationQueueQuery,
  useVerifyVolunteerMutation,
} = volunteerApi

/** Authorised, audited document download (opens the file in a new tab). */
export const openVolunteerDocument = async (token, volunteerId, docId) => {
  const res = await fetch(`${API_ORIGIN}/api/volunteers/${volunteerId}/documents/${docId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(String(res.status))
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
