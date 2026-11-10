import type { ComputedRef, Ref } from "vue"
import { createContext } from "reka-ui"

export const SIDEBAR_COOKIE_NAME = "sidebar_state"
// Persisted drag width — same cookie convention as sidebar_state above.
export const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width"
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
export const SIDEBAR_WIDTH = "16rem"
export const SIDEBAR_WIDTH_MOBILE = "18rem"
export const SIDEBAR_WIDTH_ICON = "3rem"
// Drag clamp. The upper bound is deliberately generous so a reading/preview
// pane can be pulled out wide from the left; the lower bound doubles as the
// drag-to-collapse floor.
export const SIDEBAR_WIDTH_MIN = "14rem"
export const SIDEBAR_WIDTH_MAX = "32rem"
export const SIDEBAR_KEYBOARD_SHORTCUT = "b"
export const SIDEBAR_MOBILE_BREAKPOINT = 768

const PIXELS_PER_REM = 16

function widthToPixels(width: string): number {
  const value = Number.parseFloat(width)
  return width.trim().endsWith("rem") ? value * PIXELS_PER_REM : value
}

/** Clamp any width string to [MIN, MAX], preserving its unit. */
export function clampSidebarWidth(width: string): string {
  const clampedPx = Math.max(
    widthToPixels(SIDEBAR_WIDTH_MIN),
    Math.min(widthToPixels(SIDEBAR_WIDTH_MAX), widthToPixels(width)),
  )
  return width.trim().endsWith("rem")
    ? `${(clampedPx / PIXELS_PER_REM).toFixed(1)}rem`
    : `${Math.round(clampedPx)}px`
}

/** Read a previously persisted drag width from the cookie (client only). */
export function readPersistedSidebarWidth(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SIDEBAR_WIDTH_COOKIE_NAME}=([^;]+)`),
  )
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

export const [useSidebar, provideSidebarContext] = createContext<{
  state: ComputedRef<"expanded" | "collapsed">
  open: Ref<boolean>
  setOpen: (value: boolean) => void
  isMobile: Ref<boolean>
  openMobile: Ref<boolean>
  setOpenMobile: (value: boolean) => void
  toggleSidebar: () => void
  // Drag-to-resize width (drives the --sidebar-width token).
  width: Ref<string>
  setWidth: (width: string) => void
  isDraggingRail: Ref<boolean>
  setIsDraggingRail: (value: boolean) => void
  sidebarWrapperRef: Ref<HTMLElement | null>
}>("Sidebar")
