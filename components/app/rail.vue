<script setup lang="ts" generic="V extends string">
// EXAMPLE left rail: Sontara's agent sidebar (apps/web/.../agent-shell.tsx)
// with its data swapped for yours. Identity on the shared top row, a status
// line, the toolbar strip, the labeled nav group (motion pill on hover and
// active), an exit link, and who you are in the footer. Collapses to icons
// (Ctrl/Cmd+B); on mobile it is a sheet.

import { computed } from "vue";
import { CircleDot, DoorOpen, Moon, Sparkles, Sun } from "@lucide/vue";

import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import ShellHeader from "@/components/chat/ui/shell-header.vue";
import SidebarNavItem from "@/components/chat/ui/sidebar-nav-item.vue";
import { useColorMode } from "@/components/theme/use-color-mode";
import { cn } from "@/lib/utils";
import NewChatButton from "./new-chat-button.vue";
import type { NavItem } from "./rail";

const props = defineProps<{
  /** null while it loads: the identity row shows a skeleton. */
  assistant: string | null;
  connected: boolean;
  user: { name: string; imageUrl?: string | null; subtitle?: string };
  nav: NavItem<V>[];
  activeView: V;
  onView: (v: V) => void;
  onNewChat: () => void;
}>();

const { resolvedTheme, setTheme } = useColorMode();
const statusColor = computed(() => (props.connected ? "text-emerald-500" : "text-amber-500 animate-pulse"));
const statusLabel = computed(() => (props.connected ? "Online" : "Connecting"));
</script>

<template>
  <!-- ── Identity, on the shared top row ── -->
  <ShellHeader class="min-w-0 group-data-[collapsible=icon]:justify-center">
    <div class="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
      <span v-if="assistant" class="flex min-w-0 items-center gap-2">
        <PersonAvatar :name="assistant" :size="28" />
        <span class="truncate font-display text-base font-semibold leading-tight">{{ assistant }}</span>
        <Sparkles class="ml-auto size-5 shrink-0 opacity-70" aria-hidden="true" />
      </span>
      <Skeleton v-else class="h-5 w-24" />
    </div>
    <CircleDot :class="cn('hidden size-3', statusColor, 'group-data-[collapsible=icon]:block')" />
  </ShellHeader>
  <SidebarHeader class="min-w-0 p-3 group-data-[collapsible=icon]:hidden">
    <div class="flex min-w-0 flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <CircleDot :class="cn('size-2 shrink-0', statusColor)" />
        <span class="truncate text-[11px] text-muted-foreground">{{ statusLabel }}</span>
      </div>
    </div>
  </SidebarHeader>

  <SidebarSeparator />

  <!-- ── Navigation ── -->
  <SidebarContent class="overflow-x-hidden">
    <SidebarGroup>
      <SidebarGroupContent>
        <!-- The toolbar strip (Sontara's ChatToolbar): an icon action that
             survives the collapsed rail, room to its right for more. -->
        <div class="flex min-w-0 items-center gap-1 px-1 py-0.5">
          <NewChatButton :on-new="onNewChat" />
        </div>
      </SidebarGroupContent>
    </SidebarGroup>

    <SidebarSeparator />

    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarNavItem
            v-for="item in nav"
            :key="item.id"
            :icon="item.icon"
            :accent-icon="item.accentIcon"
            :label="item.label"
            :is-active="activeView === item.id"
            pill-id="app-nav"
            :on-click="() => onView(item.id)"
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>

    <SidebarSeparator />

    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarNavItem :icon="DoorOpen" label="Home" pill-id="app-nav" href="/" />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  </SidebarContent>

  <!-- ── Footer: who you are ── -->
  <SidebarFooter class="min-w-0 p-3">
    <div class="flex min-w-0 items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
      <PersonAvatar :name="user.name" :src="user.imageUrl" :size="28" />
      <div class="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <span class="truncate text-sm font-medium leading-tight">{{ user.name }}</span>
        <span v-if="user.subtitle" class="truncate text-[11px] text-muted-foreground">{{ user.subtitle }}</span>
      </div>
      <!-- resolvedTheme, not theme: on first load theme is "system", so
           comparing it to "dark" set the mode you were already in: the
           "have to double-click" bug. -->
      <Button
        variant="ghost"
        size="icon"
        class="size-7 shrink-0 group-data-[collapsible=icon]:hidden"
        @click="setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')"
      >
        <Sun class="size-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon class="absolute size-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </div>
  </SidebarFooter>
</template>
