<script setup lang="ts" generic="R extends string = never, E extends object = object, S extends object = object, A = never, X extends object = object">
// The whole room from one config.
import { useChatRoom } from "./use-chat-room"
import ChatRoomView from "./chat-room-view.vue"
import type { ChatRoomConfig } from "./room-config"

const props = defineProps<{ config: ChatRoomConfig<R, E, S, A, X> }>()
const room = useChatRoom<R, E, S, A, X>(() => props.config)
</script>

<template>
  <ChatRoomView :room="room as never" />
</template>
