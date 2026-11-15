import { baseApi } from './baseApi'
import { scenarioUpdated } from '../slices/liveSlice'

const post = (url, body) => ({ url: `/simulation${url}`, method: 'POST', body })

export const simulationApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    closeRandomRoad: builder.mutation({
      query: () => post('/roads/random-close'),
      invalidatesTags: ['Rules'],
    }),
    closeRoad: builder.mutation({
      query: ({ edgeId, reason }) => post(`/roads/${edgeId}/close`, { reason }),
      invalidatesTags: ['Rules'],
    }),
    openRoad: builder.mutation({
      query: (edgeId) => post(`/roads/${edgeId}/open`),
      invalidatesTags: ['Rules'],
    }),
    simulateTraffic: builder.mutation({
      query: (share) => post('/traffic', { share }),
    }),
    setShelterOccupancy: builder.mutation({
      query: ({ id, rate }) => post(`/shelters/${id}/occupancy`, { rate }),
      invalidatesTags: ['Rules'],
    }),
    sosWave: builder.mutation({
      query: (body) => post('/sos-wave', body),
      invalidatesTags: ['Rules'],
    }),
    // Challenge Drop #3 — 600 fake SOS + genuine citizens against the real endpoint
    sosFlood: builder.mutation({
      query: (body) => post('/sos-flood', body),
      transformResponse: (res) => res.data.report,
      invalidatesTags: ['Queue'],
    }),
    // Challenge Drop #2 — external routing API outage (ok | 503 | timeout)
    getRoutingOutage: builder.query({
      query: () => '/simulation/routing-outage',
      transformResponse: (res) => res.data.routing,
      providesTags: ['RoutingOutage'],
    }),
    setRoutingOutage: builder.mutation({
      query: (mode) => post('/routing-outage', { mode }),
      invalidatesTags: ['RoutingOutage'],
    }),
    resetSimulation: builder.mutation({
      query: () => post('/reset'),
      invalidatesTags: ['Overview', 'Roads', 'Rules', 'Queue'],
    }),

    // ----- Disaster scenarios (demo simulator) -----
    // → { scenarios: [...], status }
    getScenarios: builder.query({
      query: () => '/simulation/scenarios',
      transformResponse: (res) => res.data,
      providesTags: ['Scenarios'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data.status) dispatch(scenarioUpdated(data.status))
        } catch {
          // surfaced by the caller
        }
      },
    }),
    startScenario: builder.mutation({
      query: (id) => post(`/scenarios/${id}/start`),
      transformResponse: (res) => res.data.scenario,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(scenarioUpdated(data))
        } catch {
          // surfaced by the caller
        }
      },
    }),
    stopScenario: builder.mutation({
      query: () => post('/scenarios/stop'),
      transformResponse: (res) => res.data.scenario,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          if (data) dispatch(scenarioUpdated(data))
        } catch {
          // surfaced by the caller
        }
      },
    }),
  }),
})

export const {
  useCloseRandomRoadMutation,
  useCloseRoadMutation,
  useOpenRoadMutation,
  useSimulateTrafficMutation,
  useSetShelterOccupancyMutation,
  useSosWaveMutation,
  useSosFloodMutation,
  useGetRoutingOutageQuery,
  useSetRoutingOutageMutation,
  useResetSimulationMutation,
  useGetScenariosQuery,
  useStartScenarioMutation,
  useStopScenarioMutation,
} = simulationApi
