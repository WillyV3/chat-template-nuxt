<script setup lang="ts">
import { computed } from "vue";

import MessageActions from "@/components/chat/message-actions.vue";
import HostActions from "@/components/chat/host-actions.vue";
import type { MessageAction } from "@/components/chat/chat/room-config";
import type { ChatMessage } from "@/components/chat/core/chat-model";
import Message from "@/components/chat/ui/message.vue";
import MessageContent from "@/components/chat/ui/message-content.vue";
import { useShrinkwrap } from "@/components/chat/use-shrinkwrap";

const props = defineProps<{
  msg: ChatMessage<string>;
  containerWidth: number | null;
  onRewind: () => void;
  actions?: MessageAction<string>[];
}>();

// User bubble has max-w-[80%] + px-4 py-3. Compute the max text width
// the pretext layout can target (bubble width minus internal padding).
const maxTextWidth = computed(() =>
  props.containerWidth != null ? Math.max(0, Math.floor(props.containerWidth * 0.8) - 32) : null,
);
const { ref: measureRef, width } = useShrinkwrap(() => props.msg.content, maxTextWidth, 22);
</script>

<template>
  <div class="group/msg">
    <Message from="user">
      <MessageContent variant="flat" :style="width != null ? { width: `${width + 32}px` } : undefined">
        <div ref="measureRef" aria-hidden="true" class="hidden" />
        <div v-if="msg.attachments && msg.attachments.length > 0" class="flex flex-wrap gap-1.5 mb-1.5">
          <img
            v-for="att in msg.attachments"
            :key="att.id"
            :src="att.preview"
            :alt="att.name"
            class="max-h-32 rounded-md border"
          />
        </div>
        {{ msg.content }}
      </MessageContent>
    </Message>
    <div class="mt-0.5 flex justify-end">
      <MessageActions
        :text="msg.content"
        :created-at-ms="msg.createdAtMs"
        align="right"
        :on-rewind="onRewind"
      >
        <HostActions :msg="msg" :actions="actions" />
      </MessageActions>
    </div>
  </div>
</template>
