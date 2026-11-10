<script setup lang="ts">
import type { HTMLAttributes, Ref } from "vue"
import { defaultDocument, useEventListener, useMediaQuery, useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "reka-ui"
import { computed, onMounted, ref } from "vue"
import { clampSidebarWidth, provideSidebarContext, readPersistedSidebarWidth, SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_COOKIE_NAME, SIDEBAR_KEYBOARD_SHORTCUT, SIDEBAR_MOBILE_BREAKPOINT, SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from "./utils"

const props = withDefaults(defineProps<{
  defaultOpen?: boolean
  open?: boolean
  /** Seed width for the very first render (before the cookie hydrates). */
  defaultWidth?: string
  class?: HTMLAttributes["class"]
}>(), {
  defaultOpen: !defaultDocument?.cookie.includes(`${SIDEBAR_COOKIE_NAME}=false`),
  open: undefined,
  defaultWidth: SIDEBAR_WIDTH,
})

const emits = defineEmits<{
  "update:open": [open: boolean]
}>()

const isMobile = useMediaQuery(`(max-width: ${SIDEBAR_MOBILE_BREAKPOINT - 1}px)`)
const openMobile = ref(false)

// Element that owns --sidebar-width; the resize composable writes to it live.
const sidebarWrapperRef = ref<HTMLElement | null>(null)
const isDraggingRail = ref(false)
function setIsDraggingRail(value: boolean) {
  isDraggingRail.value = value
}

// Drag width. Seeded from defaultWidth (SSR-stable), then hydrated from the
// cookie after mount so a hydration mismatch is impossible. setWidth clamps,
// so no caller can push it out of range.
const width = ref(clampSidebarWidth(props.defaultWidth))
function setWidth(next: string) {
  width.value = clampSidebarWidth(next)
}
onMounted(() => {
  const persisted = readPersistedSidebarWidth()
  if (persisted) setWidth(persisted)
})

const open = useVModel(props, "open", emits, {
  defaultValue: props.defaultOpen ?? false,
  passive: (props.open === undefined) as false,
}) as Ref<boolean>

function setOpen(value: boolean) {
  open.value = value // emits('update:open', value)

  // This sets the cookie to keep the sidebar state.
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open.value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}

function setOpenMobile(value: boolean) {
  openMobile.value = value
}

// Helper to toggle the sidebar.
function toggleSidebar() {
  return isMobile.value ? setOpenMobile(!openMobile.value) : setOpen(!open.value)
}

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
    event.preventDefault()
    toggleSidebar()
  }
})

// We add a state so that we can do data-state="expanded" or "collapsed".
// This makes it easier to style the sidebar with Tailwind classes.
const state = computed(() => open.value ? "expanded" : "collapsed")

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
  width,
  setWidth,
  isDraggingRail,
  setIsDraggingRail,
  sidebarWrapperRef,
})
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      ref="sidebarWrapperRef"
      data-slot="sidebar-wrapper"
      :style="{
        '--sidebar-width': width,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      }"
      :class="cn('group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full', props.class)"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </TooltipProvider>
</template>
