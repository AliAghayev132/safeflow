import { baseApi } from '@store/api/baseApi'

/** AI module endpoints (chat assistant + voice SOS). */
export const aiApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    aiChat: builder.mutation({
      query: (body) => ({ url: '/ai/chat', method: 'POST', body }),
    }),
    aiVoiceSos: builder.mutation({
      query: (body) => ({ url: '/ai/voice-sos', method: 'POST', body }),
    }),
  }),
})

export const { useAiChatMutation, useAiVoiceSosMutation } = aiApi

/** Window event fired by applyEvent when an `ai:chat` refinement arrives. */
export const AI_CHAT_EVENT = 'safeflow:ai-chat'
