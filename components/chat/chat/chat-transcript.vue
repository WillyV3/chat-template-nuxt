<script setup lang="ts">
// THE CONVERSATION WINDOW: the scrolling transcript and everything drawn in it.
//
// It renders the omitted-history stub, hands EVERY message row to the renderer
// registry (renderers.ts): that registry, not this file, is where componentry
// for the conversation is added, and draws the thinking orb and the host's
// afterTranscript slot. No socket, no send path.
//
// Two layers on purpose. ChatTranscript is the shell: it re-renders with the
// composer (the draft lives in the room composable), so it must stay cheap.
// TranscriptRows is the expensive part (every message's markdown): it only
// re-renders when one of its props changes. Every TranscriptRows prop must stay
// referentially stable across keystrokes.
//
// THE <style> BLOCK TRAVELS WITH IT. It defines `.chat-surface`, which the
// <Conversation> below is the only consumer of. Leaving it behind would separate
// a documented, load-bearing rule (the selection colour fix, and the
// user-select immunisation against a streaming-markdown mermaid drag handler
// leaking `user-select: none` onto document.body) from the element it applies to.
import type { Ref } from "vue"

import Message from "../ui/message.vue"
import MessageContent from "../ui/message-content.vue"
import Conversation from "../ui/conversation.vue"
import ConversationContent from "../ui/conversation-content.vue"
import ConversationScrollButton from "../ui/conversation-scroll-button.vue"
import AgentOrb from "../agent-orb.vue"
import { ORB_LABELS, type OrbState } from "../lib/orb-state"
import type { StickToBottomContext } from "../hooks/use-stick-to-bottom"
import TranscriptRows from "./transcript-rows.vue"
import { RoomNodeView, type RoomNode } from "./room-node"
import type { AnyRow } from "./renderers"
import type { RowsProps } from "./chat-transcript"

defineProps<{
  conversationRef?: Ref<StickToBottomContext | null>
  rows: RowsProps<AnyRow, object>
  omittedCount: number
  contentBoxRef?: Ref<HTMLElement | null>
  isAgentTyping: boolean
  streamingId: string | null
  /** A running tool's own card carries the orb (tool.hidesThinking). */
  hideThinking: boolean
  activeOrb: OrbState
  /** tool.thinking: replaces the orb's default narration. */
  thinkingLabel?: string
  /** slots.afterTranscript, drawn inside the scroll area after the rows. */
  after?: RoomNode
}>()
</script>

<template>
  <!-- Brand the native text-selection inside chat. The browser-painted
       selection rectangle can't be rounded (it's a render-layer highlight,
       not a DOM background), but tinting it primary makes the selection feel
       intentional instead of OS-default. Scoped so we don't recolor
       selection app-wide.

       The user-select:text override is load-bearing: the markdown renderer's
       mermaid diagram drag handler sets `document.body.style.userSelect =
       "none"` and relies on a cleanup to reset it. If the cleanup ever
       fails (browser pointer-capture edge cases, page unmount mid-drag),
       selection stays disabled for the whole app, including chat. Forcing
       select:text on the chat surface immunizes us from that leak.
       Interactive UI (buttons, the composer textarea) handle their own
       selection via their own classes, so this doesn't break input UX.

       Selection visibility: primary @ 22% alpha with foreground text was
       invisible in dark mode because both colors blended into the dark
       bubble bg. 45-55% alpha for the rectangle and primary-foreground on
       the text read in both themes. Mobile uses OS-native handles that
       ignore ::selection, which is why it worked there. -->
  <Conversation :context-ref="conversationRef" class="chat-surface relative min-w-0 flex-1">
    <ConversationContent class="mx-auto w-full max-w-3xl min-w-0 px-4 pt-6 pb-1">
      <div :ref="(el) => { if (contentBoxRef) contentBoxRef.value = el as HTMLElement | null }" class="w-full min-w-0 space-y-1">
        <div
          v-if="omittedCount > 0 && rows.messages.length > 0"
          class="mb-4 rounded-md border border-muted-foreground/15 bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground"
        >
          {{ omittedCount.toLocaleString() }} earlier message{{ omittedCount === 1 ? "" : "s" }} archived to keep this chat fast. Your agent still remembers them — ask anytime.
        </div>
        <TranscriptRows v-bind="rows" />
      </div>

      <Message v-if="isAgentTyping && !streamingId && !hideThinking" from="assistant" role="status" aria-live="polite">
        <MessageContent variant="flat" class="rounded-xl bg-agent-surface px-3 py-2">
          <AgentOrb :state="activeOrb" :size="20" tone="brand" :label="thinkingLabel ?? `${ORB_LABELS[activeOrb]}…`" />
        </MessageContent>
      </Message>

      <RoomNodeView :node="after" />
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>

<style>
.chat-surface, .chat-surface * {
  -webkit-user-select: text;
  user-select: text;
}
.chat-surface ::selection {
  /* color-mix() instead of hsl(): our --primary is defined as a
     hex (#0097b2 light, #26b2ce dark), not HSL components, so
     hsl(var(--primary) / 0.45) was invalid CSS and the browser
     dropped the whole rule. */
  background-color: color-mix(in srgb, var(--primary) 55%, transparent);
  color: var(--primary-foreground);
}
</style>
