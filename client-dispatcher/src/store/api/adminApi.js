import { baseApi } from './baseApi'

/**
 * Rules-engine config, audit log, RBAC and system status (/api/admin).
 */
export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // → { effective, overrides, defaults, version }
    getConfig: builder.query({
      query: () => '/admin/config',
      transformResponse: (res) => res.data,
      providesTags: ['Config'],
    }),
    updateConfig: builder.mutation({
      query: (patch) => ({ url: '/admin/config', method: 'PATCH', body: patch }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Config', 'Rules'],
    }),
    resetConfig: builder.mutation({
      query: () => ({ url: '/admin/config/reset', method: 'POST' }),
      transformResponse: (res) => res.data,
      invalidatesTags: ['Config', 'Rules'],
    }),

    // params: { action, actor, from, to, before, limit }
    getAudit: builder.query({
      query: (params) => ({ url: '/admin/audit', params }),
      transformResponse: (res) => res.data.entries,
      providesTags: ['Audit'],
    }),

    getRoles: builder.query({
      query: () => '/admin/roles',
      transformResponse: (res) => res.data.roles,
      providesTags: ['Roles'],
    }),
    getOperators: builder.query({
      query: () => '/admin/operators',
      transformResponse: (res) => res.data.operators,
      providesTags: ['Operators'],
    }),
    getSystem: builder.query({
      query: () => '/admin/system',
      transformResponse: (res) => res.data,
      providesTags: ['System'],
    }),
  }),
})

export const {
  useGetConfigQuery,
  useUpdateConfigMutation,
  useResetConfigMutation,
  useGetAuditQuery,
  useLazyGetAuditQuery,
  useGetRolesQuery,
  useGetOperatorsQuery,
  useGetSystemQuery,
} = adminApi
