<script setup lang="ts">
import { computed } from "vue";

import MessageActions from "@/components/chat/message-actions.vue";
import HostActions from "@/components/chat/host-actions.vue";
import type { MessageAction } from "@/components/chat/chat/room-config";
import type { ChatMessage } from "@/components/chat/core/chat-model";
import Message from "@/components/chat/ui/message.vue";
import MessageContent from "@/components/chat/ui/message-content.vue";
import Response from "@/components/chat/ui/response.vue";
import { useSmoothedText } from "@/components/chat/use-smoothed-text";

const props = defineProps<{
  msg: ChatMessage<string>;
  onRewind: () => void;
  agentUrl: string;
  token: string;
  actions?: MessageAction<string>[];
  /** A `shared/...` link click opens that file in the Files preview instead
   *  of downloading it. Omitted = unchanged download-on-click. */
  onOpenFile?: (path: string) => void;
}>();

// While streaming, paced client-side reveal (~80 cps) smooths fast model
// output into a visible typewriter rhythm. Once streaming ends, `displayed`
// flushes to the full content immediately.
const displayed = useSmoothedText(
  () => props.msg.content,
  () => props.msg.streaming ?? false,
  80,
);
const fileDownload = computed(() => ({
  agentUrl: props.agentUrl,
  token: props.token,
  onOpen: props.onOpenFile,
}));
</script>

<template>
  <div class="group/msg">
    <Message from="assistant">
      <!-- A HAIR off the page background (--agent-surface). The agent's words
           and its orb now sit on the same faint surface, so the orb reads as
           resting on something instead of floating, which is what made it
           look wrong on a fully transparent bubble. Deliberately below --card
           in the hierarchy: this is a tint, not a card. -->
      <MessageContent variant="flat" class="rounded-xl bg-agent-surface px-3 py-2">
        <Response
          class="font-serif text-[15px] leading-relaxed"
          :file-download="fileDownload"
          :content="displayed"
        />
      </MessageContent>
    </Message>
    <div v-if="!msg.streaming && msg.content" class="mt-0.5">
      <MessageActions
        :text="msg.content"
        :created-at-ms="msg.createdAtMs"
        align="left"
        :on-rewind="onRewind"
      >
        <HostActions :msg="msg" :actions="actions" />
      </MessageActions>
    </div>
  </div>
</template>
