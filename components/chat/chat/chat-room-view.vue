<script setup lang="ts" generic="R extends string = never, E extends object = object, S extends object = object, A = never, X extends object = object">
// The room's view layer: transcript, composer, tray, HITL cards, drop target,
// empty state and the host's slots. State and behaviour live in useChatRoom.
import { computed, onBeforeUnmount, onMounted, provide, ref } from "vue"
import { Upload } from "@lucide/vue"
import type { ChatMessage } from "@/components/chat/core/chat-model"

import HitlCards from "../hitl-cards.vue"
import { orbForTool } from "../lib/orb-state"
import AttachmentTray from "./attachment-tray.vue"
import ChatComposer from "./chat-composer.vue"
import ChatTranscript from "./chat-transcript.vue"
import { RoomKey } from "./chat-room"
import { RoomNodeView } from "./room-node"
import type { RoomApi } from "./room-config"
import { activeOrbFor, thinkingHidden, type AnyRow } from "./room-io"
import type { ChatRoomHandle } from "./use-chat-room"

const props = defineProps<{ room: ChatRoomHandle<R, E, S, A, X> }>()
const room = props.room
provide(RoomKey, room as unknown as RoomApi<string, object, object, unknown>)

const { images, pills, fileInputRef, onInputChange, handlePaste, openPicker, addFiles, removeImage, removePill } =
  room.files

// Drag a file from your computer anywhere onto the chat → attach it. The
// whole surface is the drop target (not just the composer). Counter, not a
// boolean: dragenter/dragleave fire for every child element, so a naive flag
// flickers as the cursor crosses bubbles. Only OS-file drags count.
const dragDepth = ref(0)
const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")
const onDragEnter = (e: DragEvent) => {
  if (!isFileDrag(e)) return
  e.preventDefault()
  dragDepth.value++
}
const onDragOver = (e: DragEvent) => {
  if (!isFileDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
}
const onDragLeave = (e: DragEvent) => {
  if (!isFileDrag(e)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}
const onDrop = (e: DragEvent) => {
  if (!isFileDrag(e)) return
  e.preventDefault()
  dragDepth.value = 0
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    room.pinToBottom()
    addFiles(e.dataTransfer.files)
  }
}

const contentBoxRef = ref<HTMLElement | null>(null)
// Nested in an object so the template passes the Ref itself, not its unwrapped value.
const refs = { contentBox: contentBoxRef }
const contentWidth = ref<number | null>(null)
let ro: ResizeObserver | null = null
onMounted(() => {
  const el = contentBoxRef.value
  if (!el) return
  ro = new ResizeObserver((entries) => {
    for (const entry of entries) contentWidth.value = entry.contentRect.width
  })
  ro.observe(el)
})
onBeforeUnmount(() => ro?.disconnect())

const config = computed(() => room.config)

// decorateRows should be a stable function: it re-runs when it changes.
const rows = computed(() => {
  const { decorateRows } = config.value
  return (decorateRows ? decorateRows(room.state.messages as ChatMessage<R, E>[]) : room.state.messages) as AnyRow[]
})

function shallowEqual(a: object, b: object): boolean {
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return (
    ka.length === kb.length &&
    ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

// renderContext(room) re-runs whenever the reactive state it reads changes. Keeps
// the previous object while its fields are unchanged, so the memoized rows are
// not re-rendered by every keystroke. A host whose renderContext returns a fresh
// function or object every call re-renders the rows each time the state it
// reads changes: keep those stable.
const context = computed<X>((prev) => {
  const next = (config.value.renderContext?.(room) ?? {}) as X
  return prev && shallowEqual(prev, next) ? prev : next
})

const activeOrb = computed(() =>
  activeOrbFor(rows.value, config.value.voice?.state, config.value.tool?.orbFor ?? orbForTool),
)
const thinkingLabel = computed(() => {
  const tool = config.value.tool
  if (!tool?.thinking) return undefined
  const running = [...rows.value].reverse().find((m) => m.role === "tool" && m.toolStatus === "running")
  return tool.thinking(running?.toolName)
})
const hideThinking = computed(() => thinkingHidden(rows.value, config.value.tool?.hidesThinking))

const transcriptRows = computed(() => {
  const c = config.value
  return {
    messages: rows.value,
    renderers: c.renderers as never,
    context: context.value as object,
    agentUrl: c.agent.url,
    token: c.agent.token,
    containerWidth: contentWidth.value,
    onRewind: room.rewind,
    onOpenFile: c.files?.onOpen,
    orbFor: c.tool?.orbFor,
    glyphs: c.tool?.glyphs,
    tables: c.tool?.tables,
    actionsFor: c.messageActions as never,
  }
})

const showEmpty = computed(() => room.state.messages.length === 0 && !room.state.isAgentTyping)
const hasAttachments = computed(() => images.value.length > 0 || pills.value.length > 0)
const canSend = () => (config.value.send?.canSend?.() ?? true) && (config.value.attach?.canSend?.() ?? true)
</script>

<template>
  <div
    class="relative flex h-full w-full min-w-0 flex-col overflow-hidden"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <RoomNodeView :node="config.slots?.dialogs" />

    <!-- Drop-to-attach: only paints for an OS file drag; pointer-events-none
         so it never eats the drop it invites. reduced-motion drops the fade. -->
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
    >
      <div class="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Upload class="size-6" aria-hidden="true" />
      </div>
      <p class="text-sm font-medium text-foreground">Drop to attach</p>
      <p class="text-xs text-muted-foreground">Images, PDFs, spreadsheets — anything up to 50 MB</p>
    </div>

    <RoomNodeView :node="config.slots?.banner" />

    <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <!-- The empty state is simply what an empty transcript LOOKS like,
           whatever the reason: brand-new agent, New Chat, a reset, or history
           still on its way. Never over an active exchange: a welcome screen
           under a thinking orb reads as broken.

           .chat-empty-state is held invisible for 350ms. A warm agent answers
           chat.history in ~150ms, so it unmounts before ever being seen; a
           cold one takes seconds, and the user gets a real screen instead of
           a void. The delay is in CSS so no timer/state is needed. -->
      <div v-if="showEmpty" class="chat-empty-state absolute inset-0 z-10">
        <RoomNodeView v-if="config.empty?.node" :node="config.empty.node" />
        <div v-else class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 class="text-lg font-medium text-foreground">
            <RoomNodeView v-if="config.empty?.greeting" :node="config.empty.greeting" />
            <template v-else>Ask {{ config.agent.name ?? "your agent" }} anything</template>
          </h2>
          <div v-if="config.empty?.chips && config.empty.chips.length > 0" class="flex flex-wrap justify-center gap-2">
            <button
              v-for="c in config.empty.chips"
              :key="c.label"
              type="button"
              class="cursor-pointer rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              @click="room.setInput(c.prompt, { focus: true })"
            >
              {{ c.label }}
            </button>
          </div>
        </div>
      </div>
      <ChatTranscript
        :conversation-ref="room.conversationRef"
        :rows="transcriptRows"
        :omitted-count="room.state.omittedCount"
        :content-box-ref="refs.contentBox"
        :is-agent-typing="room.state.isAgentTyping"
        :streaming-id="room.state.streamingId"
        :hide-thinking="hideThinking"
        :active-orb="activeOrb"
        :thinking-label="thinkingLabel"
        :after="config.slots?.afterTranscript"
      />
    </div>

    <!-- Status chips and handed-over context sit above the approval cards. -->
    <RoomNodeView :node="config.slots?.aboveApprovals" />

    <!-- HITL cards (exec approvals + MCP setup) -->
    <HitlCards :gateway="config.gateway as never" />

    <!-- Attachment previews (images inline + file pills) -->
    <AttachmentTray
      :images="images"
      :pills="pills"
      :on-remove-image="removeImage"
      :on-remove-pill="removePill"
    />

    <!-- Hidden file input: the paperclip (or its "save to…" menu) opens it. -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      class="hidden"
      aria-label="Attach files"
      @change="onInputChange"
    />

    <RoomNodeView :node="config.slots?.aboveComposer" />

    <ChatComposer
      :textarea-ref="room.textareaRef"
      :input="room.input"
      :on-input-change="room.onInputChange"
      :on-key-down="room.onKeyDown"
      :on-paste="handlePaste"
      :connected="room.connected"
      :composer-slot="config.composer?.slot"
      :attach="{
        onPick: openPicker,
        menu: !config.attach?.onFiles,
        hint: config.attach?.hint,
      }"
      :voice-state="config.voice?.state"
      :voice-controls="config.voice?.controls"
      :has-attachments="hasAttachments"
      :can-send="canSend()"
      :show-stop="room.state.isAgentTyping || room.state.streamingId !== null"
      :on-submit="room.submit"
      :on-abort="room.abort"
    />
  </div>
</template>

<style>
.chat-empty-state {
  animation: chat-empty-in 220ms ease-out 350ms both;
}
@keyframes chat-empty-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .chat-empty-state { animation-duration: 1ms; }
}
</style>
