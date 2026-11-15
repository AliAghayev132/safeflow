import { baseApi } from './baseApi'
import { setSession } from '../slices/authSlice'

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // → { operator, role, permissions, accessToken }
    login: builder.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (res) => res.data,
    }),
    // → { operator, role, permissions } — refreshes permissions on every load
    getMe: builder.query({
      query: () => '/auth/me',
      transformResponse: (res) => res.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setSession(data))
        } catch {
          // 401 → logout handled by baseApi
        }
      },
    }),
  }),
})

export const { useLoginMutation, useGetMeQuery } = authApi
