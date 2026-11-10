<script setup lang="ts">
// One conversation row in the Messages panel: composed from the kit's Item
// family exactly like Settings rows (ItemMedia / ItemContent / ItemActions),
// nothing restyled by hand. The whole row opens the thread via an
// inset-overlay button (the card-link pattern: native button semantics, no
// button-in-button), and the manage menu sits above it in ItemActions.

import { computed } from "vue";
import { Archive, ArchiveRestore, Bell, BellOff, MailOpen, MoreHorizontal } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { cn } from "@/lib/utils";
import { isUnread, rowTime, type RosterRow } from "./logic";
import type { ConversationSummaryRow } from "./types";

const props = withDefaults(
  defineProps<{
    row: RosterRow;
    conv: ConversationSummaryRow | undefined;
    seenReplies: ReadonlySet<string>;
    muted: boolean;
    archived?: boolean;
    onOpen: () => void;
    onMarkUnread: (lastId: string) => void;
    onToggleMuted: () => void;
    onToggleArchived: () => void;
  }>(),
  { archived: false },
);

const p = computed(() => props.row.peer);
const unseen = computed(() => isUnread(props.conv, props.seenReplies));
</script>

<template>
  <Item size="sm" class="group/row relative transition-colors hover:bg-muted/60">
    <!-- The open target: inset overlay, so the row's own layout stays the
         kit's and the menu below it stacks on top. -->
    <button
      type="button"
      :aria-label="`Open conversation with ${p.name}${unseen ? ' (unread)' : ''}`"
      class="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      @click="onOpen()"
    />
    <ItemMedia>
      <span class="relative inline-flex">
        <PersonAvatar :name="p.name" :src="p.imageUrl" :size="28" />
        <span v-if="unseen" class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />
      </span>
    </ItemMedia>
    <ItemContent>
      <ItemTitle :class="cn(unseen && 'font-semibold')">
        {{ p.name }}
        <BellOff v-if="muted" class="ml-1 inline size-3 text-muted-foreground" aria-label="Muted" />
      </ItemTitle>
      <ItemDescription v-if="conv" :class="cn('line-clamp-1', unseen && 'text-foreground')">
        {{ conv.last_from_me ? "You: " : "" }}{{ conv.last_body }}
      </ItemDescription>
      <ItemDescription v-else-if="p.status" class="line-clamp-1">{{ p.status }}</ItemDescription>
    </ItemContent>
    <ItemActions class="relative z-10 gap-1 self-start">
      <time v-if="conv" class="pt-1 text-[10px] tabular-nums text-muted-foreground" :datetime="conv.last_at">
        {{ rowTime(conv.last_at, new Date()) }}
      </time>
      <!-- Manage menu: hover/focus-revealed; always visible on touch. -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            :aria-label="`Manage conversation with ${p.name}`"
            class="size-7 cursor-pointer text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100"
          >
            <MoreHorizontal class="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem v-if="conv && !unseen" class="cursor-pointer" @select="onMarkUnread(conv.last_id)">
            <MailOpen class="size-4" aria-hidden="true" /> Mark as unread
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer" @select="onToggleMuted()">
            <template v-if="muted"><Bell class="size-4" aria-hidden="true" /> Unmute</template>
            <template v-else><BellOff class="size-4" aria-hidden="true" /> Mute</template>
          </DropdownMenuItem>
          <DropdownMenuItem class="cursor-pointer" @select="onToggleArchived()">
            <template v-if="archived"><ArchiveRestore class="size-4" aria-hidden="true" /> Unarchive</template>
            <template v-else><Archive class="size-4" aria-hidden="true" /> Archive</template>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  </Item>
</template>
