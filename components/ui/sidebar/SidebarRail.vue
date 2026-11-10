<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { useSidebarResize } from "@/components/chat/hooks/use-sidebar-resize"
import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_WIDTH_COOKIE_NAME,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  useSidebar,
} from "./utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  side?: "left" | "right"
}>(), { side: "left" })

const {
  toggleSidebar,
  state,
  width,
  setWidth,
  setIsDraggingRail,
  sidebarWrapperRef,
} = useSidebar()

// A left-hand panel is resized from a handle on its right edge, and vice
// versa. A plain click still toggles (handled inside the composable on pointer up).
const { dragRef, handlePointerDown } = useSidebarResize(() => ({
  direction: props.side === "right" ? "left" : "right",
  currentWidth: width.value,
  onResize: setWidth,
  onToggle: toggleSidebar,
  isCollapsed: state.value === "collapsed",
  minResizeWidth: SIDEBAR_WIDTH_MIN,
  maxResizeWidth: SIDEBAR_WIDTH_MAX,
  setIsDraggingRail,
  widthCookieName: SIDEBAR_WIDTH_COOKIE_NAME,
  widthCookieMaxAge: SIDEBAR_COOKIE_MAX_AGE,
  resizeRootRef: sidebarWrapperRef,
}))
</script>

<template>
  <button
    ref="dragRef"
    data-sidebar="rail"
    data-slot="sidebar-rail"
    aria-label="Toggle Sidebar"
    :tabindex="-1"
    title="Toggle Sidebar"
    :class="cn(
      'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 touch-none select-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.class,
    )"
    @pointerdown="handlePointerDown"
  >
    <slot />
  </button>
</template>
