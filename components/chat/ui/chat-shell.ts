// Layout for a chat room: collapsible left sidebar, main stage, optional docked
// right panel. Content-agnostic — the caller supplies every slot. Vendored
// verbatim by crimeminer-chat; imports only vue, sibling ui files and
// hooks/use-sidebar-resize (all vendored together, see STATE.md).

import { onMounted, ref } from "vue"
import { useSidebarResize } from "@/components/chat/hooks/use-sidebar-resize"

export type PanelResizeOptions = {
  /** Cookie that persists the width across reloads. */
  cookie: string
  defaultWidth: string
  minWidth: string
  maxWidth: string
}

/** Drag-to-resize width for a right-anchored panel. SSR renders the default; the
 *  persisted width is hydrated after mount so it never mismatches. Put `rootRef`
 *  on the element that owns `--sidebar-width`, and `dragRef`/`handlePointerDown`
 *  on a handle button at its left edge. */
export function usePanelResize({ cookie, defaultWidth, minWidth, maxWidth }: PanelResizeOptions) {
  const rootRef = ref<HTMLElement | null>(null)
  const width = ref(defaultWidth)
  onMounted(() => {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookie}=([^;]+)`))
    if (m?.[1]) width.value = decodeURIComponent(m[1])
  })
  const { dragRef, handlePointerDown } = useSidebarResize(() => ({
    direction: "left", // right-anchored: it widens as the pointer moves left
    currentWidth: width.value,
    onResize: (w: string) => {
      width.value = w
    },
    minResizeWidth: minWidth,
    maxResizeWidth: maxWidth,
    enableToggle: false,
    enableAutoCollapse: false,
    widthCookieName: cookie,
    resizeRootRef: rootRef,
  }))
  return { width, rootRef, dragRef, handlePointerDown }
}
