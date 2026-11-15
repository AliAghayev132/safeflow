import { baseApi } from '@store/api/baseApi'

/**
 * Drone supply delivery endpoints (/api/drones, feature flag `drones`).
 * The module adds its own tag types — no edits to the shared baseApi.
 */
export const dronesApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Drones', 'Supplies', 'Deliveries'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getFleet: builder.query({
        query: () => '/drones/fleet',
        transformResponse: (res) => res.data,
        providesTags: ['Drones'],
      }),
      getSupplyRequests: builder.query({
        query: (params = {}) => ({ url: '/drones/requests', params }),
        transformResponse: (res) => res.data.requests,
        providesTags: ['Supplies'],
      }),
      getEstimate: builder.query({
        query: (shelterId) => ({ url: '/drones/estimate', params: shelterId ? { shelterId } : {} }),
        transformResponse: (res) => res.data.estimate,
        providesTags: ['Supplies'],
      }),
      getSuggestion: builder.query({
        query: (requestId) => `/drones/requests/${requestId}/suggest`,
        transformResponse: (res) => res.data,
        providesTags: ['Drones', 'Supplies'],
      }),
      getDeliveries: builder.query({
        query: (params = {}) => ({ url: '/drones/deliveries', params }),
        transformResponse: (res) => res.data.deliveries,
        providesTags: ['Deliveries'],
      }),
      createSupplyRequest: builder.mutation({
        query: (body) => ({ url: '/drones/requests', method: 'POST', body }),
        invalidatesTags: ['Supplies'],
      }),
      approveSupplyRequest: builder.mutation({
        query: ({ id, droneId }) => ({ url: `/drones/requests/${id}/approve`, method: 'POST', body: droneId ? { droneId } : {} }),
        invalidatesTags: ['Supplies', 'Drones', 'Deliveries'],
      }),
      cancelSupplyRequest: builder.mutation({
        query: (id) => ({ url: `/drones/requests/${id}/cancel`, method: 'POST' }),
        invalidatesTags: ['Supplies'],
      }),
      confirmDelivery: builder.mutation({
        query: (id) => ({ url: `/drones/deliveries/${id}/confirm`, method: 'POST' }),
        invalidatesTags: ['Supplies', 'Deliveries'],
      }),
    }),
  })

export const {
  useGetFleetQuery,
  useGetSupplyRequestsQuery,
  useGetEstimateQuery,
  useLazyGetEstimateQuery,
  useGetSuggestionQuery,
  useGetDeliveriesQuery,
  useCreateSupplyRequestMutation,
  useApproveSupplyRequestMutation,
  useCancelSupplyRequestMutation,
  useConfirmDeliveryMutation,
} = dronesApi
