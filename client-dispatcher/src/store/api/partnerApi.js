import { baseApi } from './baseApi'

/**
 * Partner API administration (feature module "partnerApi").
 * Own tag types via enhanceEndpoints — no edits to the shared baseApi.
 */
export const partnerApi = baseApi
  .enhanceEndpoints({ addTagTypes: ['Partners', 'PartnerRequests', 'PartnerDetail'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getPartnerMeta: builder.query({
        query: () => '/partner/admin/meta',
        transformResponse: (res) => res.data,
      }),
      getPartners: builder.query({
        query: () => '/partner/admin/clients',
        transformResponse: (res) => res.data.clients,
        providesTags: ['Partners'],
      }),
      createPartner: builder.mutation({
        query: (body) => ({ url: '/partner/admin/clients', method: 'POST', body }),
        transformResponse: (res) => res.data,
        invalidatesTags: ['Partners'],
      }),
      updatePartner: builder.mutation({
        query: ({ id, ...body }) => ({ url: `/partner/admin/clients/${id}`, method: 'PATCH', body }),
        invalidatesTags: ['Partners'],
      }),
      setPartnerStatus: builder.mutation({
        query: ({ id, status }) => ({ url: `/partner/admin/clients/${id}/status`, method: 'POST', body: { status } }),
        invalidatesTags: ['Partners'],
      }),
      rotatePartnerSecret: builder.mutation({
        query: (id) => ({ url: `/partner/admin/clients/${id}/rotate-secret`, method: 'POST' }),
        transformResponse: (res) => res.data,
        invalidatesTags: ['Partners'],
      }),
      deletePartner: builder.mutation({
        query: (id) => ({ url: `/partner/admin/clients/${id}`, method: 'DELETE' }),
        invalidatesTags: ['Partners'],
      }),
      addPartnerWebhook: builder.mutation({
        query: ({ id, ...body }) => ({ url: `/partner/admin/clients/${id}/webhooks`, method: 'POST', body }),
        transformResponse: (res) => res.data,
        invalidatesTags: ['Partners'],
      }),
      removePartnerWebhook: builder.mutation({
        query: ({ id, webhookId }) => ({ url: `/partner/admin/clients/${id}/webhooks/${webhookId}`, method: 'DELETE' }),
        invalidatesTags: ['Partners'],
      }),
      getPartnerDeliveries: builder.query({
        query: (id) => `/partner/admin/clients/${id}/deliveries?limit=20`,
        transformResponse: (res) => res.data.deliveries,
        providesTags: ['PartnerDetail'],
      }),
      getPartnerActivity: builder.query({
        query: (id) => `/partner/admin/clients/${id}/activity?limit=30`,
        transformResponse: (res) => res.data.entries,
        providesTags: ['PartnerDetail'],
      }),
      getPartnerRequests: builder.query({
        query: (status) => ({ url: '/partner/admin/requests', params: status ? { status } : undefined }),
        transformResponse: (res) => res.data.requests,
        providesTags: ['PartnerRequests'],
      }),
      updatePartnerRequest: builder.mutation({
        query: ({ id, ...body }) => ({ url: `/partner/admin/requests/${id}`, method: 'PATCH', body }),
        invalidatesTags: ['PartnerRequests'],
      }),
    }),
  })

export const {
  useGetPartnerMetaQuery,
  useGetPartnersQuery,
  useCreatePartnerMutation,
  useUpdatePartnerMutation,
  useSetPartnerStatusMutation,
  useRotatePartnerSecretMutation,
  useDeletePartnerMutation,
  useAddPartnerWebhookMutation,
  useRemovePartnerWebhookMutation,
  useGetPartnerDeliveriesQuery,
  useGetPartnerActivityQuery,
  useGetPartnerRequestsQuery,
  useUpdatePartnerRequestMutation,
} = partnerApi
