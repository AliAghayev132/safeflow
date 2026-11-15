import { lazy } from 'react'

/** AI assistant module page — linked from Profile via ModuleLinks (`menu`) and from the SOS page. */
export const routes = [
  {
    path: 'assistant',
    feature: 'aiChatbot',
    menu: { icon: 'megaphone', labelKey: 'assistant.menu', descKey: 'assistant.menuDesc' },
    Component: lazy(() => import('@/modules/assistant/AssistantPage').then((m) => ({ default: m.AssistantPage }))),
  },
]
