<script setup lang="ts">
// The app: Sontara's agent layout with your data. Left rail (nav views),
// chat stage, and the chat sessions panel sliding in from the right: the
// same pieces Sontara runs (components/chat/ui/chat-shell.vue, the rail from
// agent-shell.tsx, the sessions panel from its Messages panel). Every piece
// of content here is an EXAMPLE meant to be replaced:
//   rail           → components/app/rail.vue
//   sessions panel → components/app/sessions/
//   sessions store → the `conversations` ref below + components/app/conversations.ts
//   backend        → lib/mock-gateway.ts (swap for useGateway(url, token))

import { computed, onMounted, ref, watch } from "vue";
import { Library, MessageSquare, Settings } from "@lucide/vue";

import type { HistoryMessage } from "@/components/chat/core/chat-history";
import ChatRoom from "@/components/chat/chat/chat-room.vue";
import { RENDERERS } from "@/components/chat/chat/renderers";
import type { ChatRoomConfig } from "@/components/chat/chat/room-config";
import ChatShell from "@/components/chat/ui/chat-shell.vue";
import AppearancePanel from "@/components/theme/appearance-panel.vue";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { GEN_UI_RENDERERS, type GenUIContext } from "@/components/gen-ui/gen-ui";
import { createMockGateway, defaultReply, type MockGateway } from "@/lib/mock-gateway";
import { EXAMPLE_CONVERSATIONS } from "./conversations";
import DetailsPanel from "./details-panel.vue";
import { GEN_UI_DEMO_PROMPT, genUiDemoReply } from "./gen-ui-demo";
import Rail from "./rail.vue";
import type { NavItem } from "./rail";
import SessionsPanel from "./sessions/sessions-panel.vue";
import { sessionSummary } from "./sessions/summary";
import type { ConversationSummaryRow } from "./sessions/types";

const ASSISTANT = "Assistant";

// Generative UI (components/gen-ui): assistant messages with a ```spec fence
// render as live components. Module level: the transcript memoizes on it.
const RENDERERS_WITH_GEN_UI = { ...RENDERERS, ...GEN_UI_RENDERERS };

// The mock answers the demo prompt with a spec; a real backend gets the same
// result by adding GEN_UI_PROMPT (components/gen-ui/catalog.ts) to its prompt.
const mockReply = (prompt: string) => (prompt === GEN_UI_DEMO_PROMPT ? genUiDemoReply() : defaultReply(prompt));

type View = "chat" | "library" | "settings";
const NAV: NavItem<View>[] = [
  { id: "chat", label: "Chat", icon: MessageSquare, accentIcon: true },
  { id: "library", label: "Library", icon: Library },
  { id: "settings", label: "Settings", icon: Settings },
];

const conversations = ref(EXAMPLE_CONVERSATIONS);
const activeId = ref(conversations.value[0].id);
const view = ref<View>("chat");
const sessionsOpen = ref(false);
const active = computed(() => conversations.value.find((c) => c.id === activeId.value)!);

// One backend per conversation, created once and kept, so switching back
// finds the turns you left there.
const gateways = new Map<string, MockGateway>();
function gatewayFor(id: string, history: HistoryMessage[] = []) {
  if (!gateways.has(id)) gateways.set(id, createMockGateway({ history, reply: mockReply }));
  return gateways.get(id)!;
}
const gateway = computed(() => gatewayFor(active.value.id, active.value.history));

// The sessions panel rows: each session's latest message, read through the
// same chat.history the room uses. Refreshed whenever a reply finishes, the
// way Sontara's panel polls its summary endpoint.
const convs = ref<ConversationSummaryRow[]>([]);
async function refreshConvs() {
  const rows = await Promise.all(
    conversations.value.map(async (c) => {
      const { messages } = await gatewayFor(c.id, c.history).rpc<{ messages: HistoryMessage[] }>("chat.history");
      return sessionSummary(c.id, messages);
    }),
  );
  convs.value = rows.filter((r): r is ConversationSummaryRow => !!r);
}
// Client-only (like the React effect): the server render has no live gateways to read.
onMounted(() =>
  watch(
    conversations,
    (cs, _prev, onCleanup) => {
      void refreshConvs();
      const onChat = (p: unknown) => {
        if ((p as { state?: string }).state === "final") void refreshConvs();
      };
      const all = cs.map((c) => gatewayFor(c.id, c.history));
      for (const g of all) g.on("chat", onChat);
      onCleanup(() => {
        for (const g of all) g.off("chat", onChat);
      });
    },
    { immediate: true },
  ),
);

// renderContext must return stable values (the room shallow-compares it every
// run); room.send may change, so route through a variable.
let sendFn: ((text: string) => void) | undefined;
const genUiContext: GenUIContext = { send: (text) => sendFn?.(text) };

const config = computed<ChatRoomConfig<never, object, object, never, GenUIContext>>(() => ({
  gateway: gateway.value,
  // url/token feed the room's built-in upload + download links; the example
  // attach.onFiles below means nothing is uploaded anywhere.
  agent: { url: "", token: "", name: ASSISTANT },
  user: {},
  renderers: RENDERERS_WITH_GEN_UI,
  // Lets a generated button send a follow-up (the send_message action).
  renderContext: (room) => {
    sendFn = room.send;
    return genUiContext;
  },
  attach: {
    // Each file becomes a pill and a note on the outgoing text. Upload to
    // your own storage here and return its path instead.
    onFiles: async (files) => files.map((f) => ({ label: f.name, size: f.size, note: `[attached: ${f.name}]` })),
  },
  empty: {
    greeting: `Ask ${ASSISTANT} anything`,
    chips: [
      { label: "Summarize a doc", prompt: "Summarize this document in five bullets." },
      { label: "Write a SQL query", prompt: "Write a SQL query that finds duplicate emails." },
      { label: "Brainstorm names", prompt: "Brainstorm ten names for a note-taking app." },
      { label: "Generate a UI", prompt: GEN_UI_DEMO_PROMPT },
    ],
  },
}));

function newChat() {
  const id = `chat-${Date.now()}`;
  conversations.value = [{ id, title: "New chat", history: [] }, ...conversations.value];
  activeId.value = id;
  view.value = "chat";
}

function openSession(id: string) {
  activeId.value = id;
  view.value = "chat";
}

const title = computed(() => (view.value === "chat" ? active.value.title : NAV.find((i) => i.id === view.value)!.label));
</script>

<template>
  <ChatShell>
    <template #mobileTitle>
      <span class="font-display text-base font-semibold">{{ title }}</span>
    </template>
    <template #header>
      <span class="truncate text-sm font-medium">{{ title }}</span>
      <div class="ml-auto flex items-center gap-1">
        <SessionsPanel
          :sessions="conversations.map((c) => ({ id: c.id, name: c.title }))"
          :convs="convs"
          :active-id="view === 'chat' ? active.id : undefined"
          :on-open-session="openSession"
          :open="sessionsOpen"
          :on-open-change="(o) => (sessionsOpen = o)"
        >
          <template #details><DetailsPanel :conversation="active" :assistant="ASSISTANT" /></template>
        </SessionsPanel>
      </div>
    </template>
    <template #sidebar>
      <Rail
        :assistant="ASSISTANT"
        :connected="gateway.connected"
        :user="{ name: 'You', subtitle: 'Free plan' }"
        :nav="NAV"
        :active-view="view"
        :on-view="(v) => (view = v)"
        :on-new-chat="newChat"
      />
    </template>
    <!-- key: a conversation switch remounts the room so it loads that history. -->
    <ChatRoom v-if="view === 'chat'" :key="active.id" :config="config" />
    <Empty v-else-if="view === 'library'" class="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Library /></EmptyMedia>
        <EmptyTitle>Your view here</EmptyTitle>
        <EmptyDescription>Each nav item swaps the stage. Add views in components/app/chat-app.vue.</EmptyDescription>
      </EmptyHeader>
    </Empty>
    <div v-else class="h-full overflow-y-auto p-4 md:p-6">
      <div class="mx-auto max-w-4xl"><AppearancePanel /></div>
    </div>
  </ChatShell>
</template>
