import { baseApi } from './baseApi'
import {
  overviewLoaded,
  roadsLoaded,
  alertUpserted,
  brigadeUpserted,
  shelterUpserted,
  sosUpserted,
  profilesLoaded,
} from '../slices/liveSlice'

// Push a query / mutation result into the live slice right away (the socket
// event will arrive too — upserts are idempotent).
const upsertOnSuccess = (action, pick) => async (_arg, { dispatch, queryFulfilled }) => {
  try {
    const { data } = await queryFulfilled
    dispatch(action(pick(data)))
  } catch {
    // error is surfaced by the caller
  }
}

export const dispatcherApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getOverview: builder.query({
      query: () => '/dispatcher/overview',
      transformResponse: (res) => res.data,
      providesTags: ['Overview'],
      onQueryStarted: upsertOnSuccess(overviewLoaded, (d) => d),
    }),
    getRoads: builder.query({
      query: () => '/roads',
      transformResponse: (res) => res.data,
      providesTags: ['Roads'],
      onQueryStarted: upsertOnSuccess(roadsLoaded, (d) => d),
    }),
    getRules: builder.query({
      query: () => '/dispatcher/rules',
      transformResponse: (res) => res.data.rules,
      providesTags: ['Rules'],
    }),

    // ----- Triage -----
    // → { queue (priority desc), profiles: { deviceId: profile } }
    getQueue: builder.query({
      query: () => '/dispatcher/sos/queue',
      transformResponse: (res) => res.data,
      providesTags: ['Queue'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sosUpserted(data.queue))
          dispatch(profilesLoaded(data.profiles))
        } catch {
          // surfaced by the caller
        }
      },
    }),
    assignSos: builder.mutation({
      query: ({ id, brigadeId }) => ({
        url: `/dispatcher/sos/${id}/assign`,
        method: 'POST',
        body: brigadeId ? { brigadeId } : {},
      }),
      transformResponse: (res) => res.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sosUpserted(data.sos))
          dispatch(brigadeUpserted(data.brigade))
        } catch {
          // surfaced by the caller
        }
      },
    }),
    getMyBrigade: builder.query({
      query: () => '/dispatcher/my-brigade',
      transformResponse: (res) => res.data,
      providesTags: ['MyBrigade'],
    }),

    // ----- Alerts -----
    getAlerts: builder.query({
      query: (status) => ({ url: '/dispatcher/alerts', params: status ? { status } : undefined }),
      transformResponse: (res) => res.data.alerts,
      providesTags: ['Alerts'],
    }),
    approveAlert: builder.mutation({
      // arg: alertId, or { id, brigadeId } when the dispatcher picked an alternative
      query: (arg) => {
        const { id, brigadeId } = typeof arg === 'string' ? { id: arg } : arg
        return { url: `/dispatcher/alerts/${id}/approve`, method: 'POST', body: brigadeId ? { brigadeId } : undefined }
      },
      transformResponse: (res) => res.data.alert,
      onQueryStarted: upsertOnSuccess(alertUpserted, (a) => a),
    }),
    rejectAlert: builder.mutation({
      query: (id) => ({ url: `/dispatcher/alerts/${id}/reject`, method: 'POST' }),
      transformResponse: (res) => res.data.alert,
      onQueryStarted: upsertOnSuccess(alertUpserted, (a) => a),
    }),
    resolveAlert: builder.mutation({
      query: (id) => ({ url: `/dispatcher/alerts/${id}/resolve`, method: 'POST' }),
      transformResponse: (res) => res.data.alert,
      onQueryStarted: upsertOnSuccess(alertUpserted, (a) => a),
    }),

    // ----- Brigades / SOS / Shelters -----
    updateBrigadeStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/dispatcher/brigades/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (res) => res.data.brigade,
      invalidatesTags: ['MyBrigade'],
      onQueryStarted: upsertOnSuccess(brigadeUpserted, (b) => b),
    }),
    updateSosStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/dispatcher/sos/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (res) => res.data.sos,
      onQueryStarted: upsertOnSuccess(sosUpserted, (s) => s),
    }),
    updateShelter: builder.mutation({
      query: ({ id, isActive }) => ({
        url: `/dispatcher/shelters/${id}`,
        method: 'PATCH',
        body: { isActive },
      }),
      transformResponse: (res) => res.data.shelter,
      onQueryStarted: upsertOnSuccess(shelterUpserted, (s) => s),
    }),
  }),
})

export const {
  useGetOverviewQuery,
  useGetRoadsQuery,
  useGetRulesQuery,
  useGetQueueQuery,
  useAssignSosMutation,
  useGetMyBrigadeQuery,
  useGetAlertsQuery,
  useApproveAlertMutation,
  useRejectAlertMutation,
  useResolveAlertMutation,
  useUpdateBrigadeStatusMutation,
  useUpdateSosStatusMutation,
  useUpdateShelterMutation,
} = dispatcherApi
