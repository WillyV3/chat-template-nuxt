<script setup lang="ts">
// Slots: `sidebar` (contents of the collapsible left rail), `mobileTitle` (shown
// beside the sidebar trigger in the mobile header; ignored when `header` is set),
// `header` (the stage's top row, at every width; on mobile it carries the sidebar
// trigger), `right` (optional docked right panel, md+ only, drag-resizable),
// `rightHeader` (the right panel's top row; stays put while the panel scrolls),
// default (the main stage).
import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { usePanelResize } from "./chat-shell"
import ShellHeader from "./shell-header.vue"

const props = withDefaults(defineProps<{
  /** Drop the rail entirely (e.g. a full-screen takeover). */
  hideSidebar?: boolean
  rightCookie?: string
}>(), { hideSidebar: false, rightCookie: "chat_shell_right_width" })

const { width, rootRef, dragRef, handlePointerDown } = usePanelResize({
  cookie: props.rightCookie,
  defaultWidth: "24rem",
  minWidth: "20rem",
  maxWidth: "40rem",
})
</script>

<template>
  <SidebarProvider class="!h-full !min-h-0">
    <Sidebar v-if="!hideSidebar" collapsible="icon">
      <slot name="sidebar" />
    </Sidebar>
    <main class="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <ShellHeader v-if="$slots.header">
        <SidebarTrigger class="md:hidden" />
        <slot name="header" />
      </ShellHeader>
      <div v-else class="flex shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden">
        <SidebarTrigger />
        <slot name="mobileTitle" />
      </div>
      <div class="flex min-h-0 flex-1 flex-col">
        <slot />
      </div>
    </main>
    <aside
      v-if="$slots.right"
      ref="rootRef"
      :style="{ '--sidebar-width': width }"
      class="relative hidden h-full min-h-0 w-[var(--sidebar-width)] shrink-0 flex-col border-l md:flex"
    >
      <button
        ref="dragRef"
        aria-label="Resize panel"
        tabindex="-1"
        class="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize touch-none select-none bg-transparent transition-colors hover:bg-primary/40"
        @pointerdown="handlePointerDown"
      />
      <ShellHeader v-if="$slots.rightHeader">
        <slot name="rightHeader" />
      </ShellHeader>
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <slot name="right" />
      </div>
    </aside>
  </SidebarProvider>
</template>
