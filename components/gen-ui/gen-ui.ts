// Generative UI in the chat. Hook it in (components/app/chat-app.vue does this):
//   renderers:     { ...RENDERERS, ...GEN_UI_RENDERERS }
//   renderContext: a STABLE { send } (room.send changes every render, so it
//                  goes through a ref): buttons can reply
//   backend:       system prompt += GEN_UI_PROMPT (./catalog)

import type { ChatMessage } from "@/components/chat/core/chat-model";
import type { Renderers } from "@/components/chat/chat/renderers";
import GenUIMessage from "./gen-ui-message.vue";

/** What the host passes through ChatRoomConfig.renderContext. */
export type GenUIContext = { send?: (text: string) => void };

/** Spread into your renderers map. Replaces the assistant row: a message
 *  without a ```spec fence renders exactly as the plain bubble. (No `when`
 *  gate: an assistant row has no fallback kind, a failed gate draws nothing.) */
export const GEN_UI_RENDERERS: Renderers<ChatMessage<string>, GenUIContext> = {
  assistant: { Component: GenUIMessage },
};
