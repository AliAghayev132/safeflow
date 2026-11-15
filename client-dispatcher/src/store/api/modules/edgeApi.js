import { baseApi } from '../baseApi'

/**
 * Feature module "edgeNode": edge node registry on the central server.
 * Token in the create / rotate response is shown ONCE.
 */
export const edgeApi = baseApi.enhanceEndpoints({ addTagTypes: ['EdgeNodes'] }).injectEndpoints({
  endpoints: (builder) => ({
    getEdgeNodes: builder.query({
      query: () => '/edge/v1/nodes',
      transformResponse: (res) => res.data.nodes,
      providesTags: ['EdgeNodes'],
    }),
    createEdgeNode: builder.mutation({
      query: (body) => ({ url: '/edge/v1/nodes', method: 'POST', body }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['EdgeNodes'],
    }),
    rotateEdgeNode: builder.mutation({
      query: (id) => ({ url: `/edge/v1/nodes/${id}/rotate`, method: 'POST' }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['EdgeNodes'],
    }),
    revokeEdgeNode: builder.mutation({
      query: (id) => ({ url: `/edge/v1/nodes/${id}/revoke`, method: 'POST' }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['EdgeNodes'],
    }),
  }),
})

export const {
  useGetEdgeNodesQuery,
  useCreateEdgeNodeMutation,
  useRotateEdgeNodeMutation,
  useRevokeEdgeNodeMutation,
} = edgeApi
