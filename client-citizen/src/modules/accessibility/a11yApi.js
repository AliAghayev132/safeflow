import { baseApi, API_ORIGIN } from '@store/api'

/** Endpoint the shortcuts call (shown on the setup page). */
export const SHORTCUT_SOS_URL = `${API_ORIGIN}/api/a11y/v1/sos`

/**
 * Personal shortcut token (backend modules/accessibility). The plain token is
 * returned only by `issueShortcutToken` and is never cached or stored.
 */
export const a11yApi = baseApi.enhanceEndpoints({ addTagTypes: ['ShortcutToken'] }).injectEndpoints({
  endpoints: (builder) => ({
    getShortcutToken: builder.query({
      query: (deviceId) => ({ url: '/a11y/v1/shortcut-token', params: { deviceId } }),
      transformResponse: (data) => data?.token ?? { active: false },
      providesTags: ['ShortcutToken'],
    }),
    issueShortcutToken: builder.mutation({
      query: (deviceId) => ({ url: '/a11y/v1/shortcut-token', method: 'POST', body: { deviceId } }),
      transformResponse: (data) => data?.token,
      invalidatesTags: ['ShortcutToken'],
    }),
    revokeShortcutToken: builder.mutation({
      query: (deviceId) => ({ url: '/a11y/v1/shortcut-token', method: 'DELETE', body: { deviceId } }),
      invalidatesTags: ['ShortcutToken'],
    }),
  }),
})

export const { useGetShortcutTokenQuery, useIssueShortcutTokenMutation, useRevokeShortcutTokenMutation } = a11yApi
