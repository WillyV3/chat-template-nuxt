<script setup lang="ts">
// A host's per-row actions (ChatRoomConfig.messageActions) as icon buttons.
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/components/chat/core/chat-model";
import type { MessageAction } from "@/components/chat/chat/room-config";

defineProps<{
  msg: ChatMessage<string>;
  actions?: MessageAction<string>[];
}>();
</script>

<template>
  <template v-if="actions && actions.length > 0">
    <Tooltip v-for="a in actions" :key="a.label">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="size-6 p-0 text-muted-foreground hover:text-foreground"
          :aria-label="a.label"
          @click="a.run(msg)"
        >
          <component :is="a.icon" v-if="a.icon" class="size-3" />
          <span v-else class="text-[10px]">{{ a.label }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>{{ a.label }}</p></TooltipContent>
    </Tooltip>
  </template>
</template>
