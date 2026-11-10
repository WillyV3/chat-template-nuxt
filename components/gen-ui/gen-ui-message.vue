<script setup lang="ts">
// Generative UI in the chat: an assistant message carrying a ```spec fence
// renders its prose in the normal bubble and the spec as live shadcn
// components under it, built progressively while it streams.
import { computed } from "vue";

import AssistantMessageBubble from "@/components/chat/assistant-message-bubble.vue";
import type { ChatMessage } from "@/components/chat/core/chat-model";
import type { MessageAction } from "@/components/chat/chat/room-config";
import GenUI from "./gen-ui.vue";
import { hasSpec, splitSpec } from "./spec-text";

// The slice of MessageRenderContext<ChatMessage<string>, GenUIContext> this row uses.
const props = defineProps<{
  msg: ChatMessage<string>;
  agentUrl: string;
  token: string;
  onRewind: (msgId: string) => void;
  onOpenFile?: (path: string) => void;
  actions?: MessageAction<string>[];
  send?: (text: string) => void;
}>();

const streaming = computed(() => props.msg.streaming ?? false);
const parsed = computed(() =>
  hasSpec(props.msg.content) ? splitSpec(props.msg.content, streaming.value) : { text: props.msg.content, spec: null },
);
const handlers = {
  send_message: (p: Record<string, unknown>) => typeof p.text === "string" && props.send?.(p.text),
};
</script>

<template>
  <AssistantMessageBubble
    v-if="parsed.text || !parsed.spec"
    :msg="{ ...msg, content: parsed.text }"
    :on-rewind="() => onRewind(msg.id)"
    :agent-url="agentUrl"
    :token="token"
    :on-open-file="onOpenFile"
    :actions="actions"
  />
  <div v-if="parsed.spec?.root && parsed.spec.elements[parsed.spec.root]" class="w-full min-w-0 max-w-full overflow-x-auto py-1">
    <GenUI :spec="parsed.spec" :loading="streaming" :handlers="handlers" />
  </div>
</template>
