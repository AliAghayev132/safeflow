import { baseApi } from '../baseApi'

/** Feature module "edgeNode": is this app served by an assembly-point edge node? */
export const edgeApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEdgeInfo: builder.query({
      query: () => '/edge/v1/info',
    }),
  }),
})

export const { useGetEdgeInfoQuery } = edgeApi
