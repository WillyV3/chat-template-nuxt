<script setup lang="ts">
// Attachment previews above the composer: images as thumbnails, files as kit
// Items. Remove buttons are ALWAYS visible: hover-only was untouchable on phones.
import { X } from "@lucide/vue";
import type { Attachment } from "@/components/chat/core/chat-model";

import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

import ExtensionBadge from "../files/extension-badge.vue";
import { splitName } from "../files/model";
import type { RoomPill } from "./room-io";
import { pillCaption } from "./attachment-tray";

defineProps<{
  images: Attachment[];
  pills: RoomPill[];
  onRemoveImage: (id: string) => void;
  onRemovePill: (id: string) => void;
}>();
</script>

<template>
  <div v-if="images.length > 0 || pills.length > 0" class="shrink-0">
    <!-- Same column as the composer: the tray is part of the message being
         written, not a page-wide banner. -->
    <div class="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-3 pt-2 sm:px-4">
      <div v-for="att in images" :key="att.id" class="relative shrink-0">
        <img :src="att.preview" :alt="att.name" class="size-14 rounded-lg border object-cover" />
        <button
          type="button"
          :aria-label="`Remove attachment ${att.name}`"
          class="absolute -right-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          @click="onRemoveImage(att.id)"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </div>
      <Item
        v-for="pill in pills"
        :key="pill.id"
        variant="outline"
        size="sm"
        class="w-auto shrink-0 gap-2 rounded-lg bg-background py-1.5 pl-2 pr-1"
      >
        <ItemMedia>
          <ExtensionBadge :ext="splitName(pill.label).ext" />
        </ItemMedia>
        <ItemContent class="gap-0">
          <ItemTitle class="max-w-44 truncate text-xs">{{ pill.label }}</ItemTitle>
          <ItemDescription class="line-clamp-1 max-w-44 text-[10px]">
            {{ pillCaption(pill) }}
          </ItemDescription>
        </ItemContent>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          :aria-label="`Remove uploaded file ${pill.label}`"
          class="size-6 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          @click="onRemovePill(pill.id)"
        >
          <X class="size-3.5" aria-hidden="true" />
        </Button>
      </Item>
    </div>
  </div>
</template>
