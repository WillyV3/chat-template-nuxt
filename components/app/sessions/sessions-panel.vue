<script setup lang="ts">
// The chat sessions panel (badge + sheet), vendored from Sontara's Messages
// panel (apps/web/.../relay-panel.tsx). Same sheet, slide, drag-resize, tabs,
// search, archived shelf and row menu; the data is your chat sessions instead
// of Sontara's circle. Cut from the original: Clerk team invites, circle peer
// invites and the in-panel thread view (a row here opens the session in the
// main chat instead).
//
// Slot `details`: the Details tab's content, scoped with `close` so the caller
// can also close this sheet. Mounted only while the tab is active (reka
// unmounts inactive TabsContent).

import { computed, ref, useSlots, watch, type CSSProperties } from "vue";
import { usePanelResize } from "@/components/chat/ui/chat-shell";
import { ChevronRight, Inbox, MessagesSquare, Search, Settings2 } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import Hint from "@/components/chat/ui/hint.vue";
import { ItemGroup } from "@/components/ui/item";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import ConversationRow from "./conversation-row.vue";
import { useCirclePrefs } from "./use-circle-prefs";
import { useUnread } from "./use-unread";
import { filterRoster, freshCount, partitionRoster, type RosterRow } from "./logic";
import type { ConversationSummaryRow, Peer } from "./types";

// Drag-to-resize width (Willy 2026-08-12), via usePanelResize: the same
// lumpinif mechanism as the nav rail (#99), one resize behaviour everywhere.
const PANEL_RESIZE = {
  cookie: "sessions_panel_width",
  defaultWidth: "24rem", // was the fixed w-96
  minWidth: "20rem",
  maxWidth: "40rem",
};

const props = defineProps<{
  /** Every session, newest first (id + title). */
  sessions: Peer[];
  /** One summary per session that has messages (its latest message). */
  convs: ConversationSummaryRow[];
  /** The session on screen: a reply you watched arrive is not unread. */
  activeId?: string;
  /** A row was clicked: show that session in the main chat. */
  onOpenSession: (id: string) => void;
  /** Gear in this panel's header → wherever sessions are administered. */
  onManage?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>();
const slots = useSlots();

const tab = ref<"sessions" | "details">("sessions");

const { width: panelWidth, rootRef, dragRef, handlePointerDown } = usePanelResize(PANEL_RESIZE);
// SheetContent renders into a portal and hands its attrs to the dialog element,
// so a component ref is no element: find it from inside.
const dragButton = ref<HTMLButtonElement | null>(null);
watch(dragButton, (el) => {
  dragRef.value = el;
  rootRef.value = el?.closest<HTMLElement>('[data-slot="sheet-content"]') ?? null;
});

const setOpen = (o: boolean) => props.onOpenChange(o);
// convs = ONE ROW PER SESSION.
const convByPerson = computed(() => new Map(props.convs.map((c) => [c.person_id, c])));

const { seenReplies, panelSeenAt, markSeen, markUnread } = useUnread(() => props.open);
const activeLast = computed(() => (props.activeId ? convByPerson.value.get(props.activeId)?.last_id : undefined));
watch(activeLast, (id) => id && markSeen(id), { immediate: true });
// Fetched on FIRST open, never on chat load (nextjs-anti-patterns pass).
const everOpened = ref(false);
watch(() => props.open, (o) => o && (everOpened.value = true), { immediate: true });
const prefs = useCirclePrefs(everOpened);
const search = ref("");

// The session list: pure partition/filter in logic: archived rows shelve
// below; search narrows.
const roster = computed<RosterRow[]>(() => props.sessions.map((peer) => ({ peer, lane: "peer" as const })));
const partition = computed(() => partitionRoster(filterRoster(roster.value, search.value), prefs.archived.value));
const activeRoster = computed(() => partition.value.active);
const archivedRoster = computed(() => partition.value.archived);

function openRow(row: RosterRow) {
  const conv = convByPerson.value.get(row.peer.id);
  if (conv) markSeen(conv.last_id);
  props.onOpenSession(row.peer.id);
  setOpen(false);
}

// Muted and archived sessions never ring the button: that's what mute means.
const quiet = computed(() => new Set([...prefs.muted.value, ...prefs.archived.value]));
const badgeCount = computed(() => freshCount(props.convs, seenReplies.value, panelSeenAt.value, quiet.value));

// MOBILE = the pre-resize classes VERBATIM (w-96 + sm:max-w-96 was the shipped,
// working shape; an inline `width` here broke the panel on phones, Willy
// 2026-08-13). The drag-resize var applies at sm+ ONLY: the hook writes
// --sidebar-width live during a drag, state + cookie commit on pointer-up, and
// the sm: width class picks it up.
const sheetStyle = computed(() => ({ "--sidebar-width": panelWidth.value }) as CSSProperties);
</script>

<template>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="relative shrink-0 cursor-pointer gap-1.5"
    :aria-label="`Chats: ${badgeCount} unread`"
    @click="setOpen(!open)"
  >
    <Inbox class="size-4" aria-hidden="true" />
    <span
      v-if="badgeCount > 0"
      class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
    >
      {{ badgeCount }}
    </span>
  </Button>
  <Sheet :open="open" @update:open="setOpen">
    <!-- Sturdy shell (Willy 2026-07-23): portal-rendered Sheet, focus-
         trapped; closing is deliberate (X, Esc or overlay click).
         transition-none: the shadcn base stacks a CSS transition ON TOP of
         the animate-in keyframes: two easings interpolating the same
         transform = the mid-slide stutter. Keyframes alone, one easing.
         NO `relative` HERE. SheetContent's own classes include `fixed`, and
         cn() is tailwind-merge: a position utility in this string WINS over
         the primitive's, which drops the panel out of the viewport entirely
         (it rendered bottom-left at content size, Willy, twice). A fixed
         element is already a containing block, so the resize handle's
         `absolute` below still anchors to this panel. -->
    <SheetContent
      side="right"
      :style="sheetStyle"
      class="flex w-96 flex-col gap-0 overflow-y-auto p-4 transition-none will-change-transform ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:duration-200 data-[state=open]:duration-250 sm:w-[var(--sidebar-width)] sm:max-w-[40rem]"
    >
      <!-- Drag-to-resize handle on the LEFT edge (right-anchored panel).
           Same lumpinif hook as the nav rail; desktop-only: resizing an
           overlay on a phone is pointless and it's near-full-width there. -->
      <button
        ref="dragButton"
        aria-label="Resize panel"
        tabindex="-1"
        class="absolute inset-y-0 left-0 z-20 hidden w-1.5 cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-primary/40 sm:block"
        @pointerdown="handlePointerDown"
      />
      <!-- Kit Tabs host the whole body: the header row carries the
           Chats | Details triggers (the visible "title"), and each tab's
           content is a TabsContent below. -->
      <Tabs
        :model-value="tab"
        class="flex min-h-0 flex-1 flex-col gap-0"
        @update:model-value="(v) => (tab = v === 'details' ? 'details' : 'sessions')"
      >
        <SheetHeader class="mb-2 flex-row items-center justify-between space-y-0 p-0">
          <SheetTitle class="sr-only">Chats</SheetTitle>
          <SheetDescription class="sr-only">Your chat sessions and details.</SheetDescription>
          <TabsList v-if="slots.details" class="h-8">
            <TabsTrigger value="sessions" class="px-2.5 text-xs">Chats</TabsTrigger>
            <TabsTrigger value="details" class="px-2.5 text-xs">Details</TabsTrigger>
          </TabsList>
          <span v-else class="text-sm font-semibold">Chats</span>
          <!-- This panel is for DOING; the gear is the door to administering
               it. Sits left of the Sheet's own close button, hence the
               margin. -->
          <Hint v-if="onManage" label="Manage">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="mr-6 size-7 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              @click="setOpen(false); onManage?.()"
            >
              <Settings2 class="size-4" aria-hidden="true" />
            </Button>
          </Hint>
        </SheetHeader>
        <TabsContent value="sessions" class="min-h-0 flex-1 overflow-y-auto outline-none">
          <!-- The row IS the session; the manage menu (mark unread / mute /
               archive) rides its right edge. -->
          <div v-if="roster.length > 0">
            <p class="mb-1 px-1 text-xs font-medium text-muted-foreground">Conversations</p>
            <!-- Search earns its pixels only once the list can actually get
                 lost: short lists never see it. Kit InputGroup, same as
                 every other icon-in-input in the app. -->
            <InputGroup v-if="roster.length > 5" class="mb-1.5 h-8">
              <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput v-model="search" placeholder="Search conversations" aria-label="Search conversations" />
            </InputGroup>
            <ItemGroup>
              <ConversationRow
                v-for="row in activeRoster"
                :key="row.peer.id"
                :row="row"
                :conv="convByPerson.get(row.peer.id)"
                :seen-replies="seenReplies"
                :muted="prefs.muted.value.has(row.peer.id)"
                :on-open="() => openRow(row)"
                :on-mark-unread="markUnread"
                :on-toggle-muted="() => prefs.toggleMuted(row.peer.id)"
                :on-toggle-archived="() => prefs.toggleArchived(row.peer.id)"
              />
            </ItemGroup>
            <p v-if="activeRoster.length === 0 && search.trim()" class="py-3 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{{ search.trim() }}&rdquo;.
            </p>
            <!-- The archived shelf: closed by default, unread dots still
                 visible inside so nothing silently disappears. -->
            <Collapsible v-if="archivedRoster.length > 0" class="mt-2">
              <CollapsibleTrigger as-child>
                <Button type="button" variant="ghost" size="sm" class="group w-full cursor-pointer justify-start gap-1.5 text-xs text-muted-foreground">
                  <ChevronRight class="size-3.5 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
                  Archived <span class="tabular-nums">({{ archivedRoster.length }})</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ItemGroup>
                  <ConversationRow
                    v-for="row in archivedRoster"
                    :key="row.peer.id"
                    :row="row"
                    :conv="convByPerson.get(row.peer.id)"
                    :seen-replies="seenReplies"
                    :muted="prefs.muted.value.has(row.peer.id)"
                    archived
                    :on-open="() => openRow(row)"
                    :on-mark-unread="markUnread"
                    :on-toggle-muted="() => prefs.toggleMuted(row.peer.id)"
                    :on-toggle-archived="() => prefs.toggleArchived(row.peer.id)"
                  />
                </ItemGroup>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <Empty v-else class="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><MessagesSquare /></EmptyMedia>
              <EmptyTitle>No conversations yet</EmptyTitle>
              <EmptyDescription>Start a new chat from the sidebar: it shows up here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>
        <TabsContent v-if="slots.details" value="details" class="flex min-h-0 flex-1 flex-col outline-none">
          <slot name="details" :close="() => setOpen(false)" />
        </TabsContent>
      </Tabs>
    </SheetContent>
  </Sheet>
</template>
