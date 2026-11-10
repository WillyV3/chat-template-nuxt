import { onBeforeUnmount, onMounted, ref, toValue, type MaybeRefOrGetter, type Ref } from "vue"

/**
 * Drag-to-resize behaviour for the shadcn sidebar rail.
 *
 * Adapted from lumpinif/shadcn-resizable-sidebar. Kept faithful to the upstream
 * mechanism — pointer-driven width tracking, min/max clamp, VS Code-style
 * drag-to-(un)collapse, and cookie persistence — while dropping the upstream's
 * legacy mouse-event path (pointer events already cover mouse/touch/pen) and its
 * nested-panel branch (every sidebar in this app sits at the window edge).
 *
 * The width is written straight to the element that owns `--sidebar-width` on
 * every pointer move so the drag tracks with no re-render; reactive state and
 * the cookie are committed once, on pointer up.
 */

/** Which side of the panel the drag handle sits on. */
export type SidebarResizeDirection = "left" | "right"

export interface UseSidebarResizeOptions {
  /** "right" for a left-hand panel (handle on its right edge), "left" for a right-hand panel. */
  direction?: SidebarResizeDirection
  /** Current panel width, e.g. "16rem" or "260px". */
  currentWidth: string
  /** Commit a new width to reactive state. Called at drag start and on pointer up. */
  onResize: (width: string) => void
  /** Toggle collapsed/expanded — fires on a plain click and on drag-to-(un)collapse. */
  onToggle?: () => void
  /** Whether the panel is currently collapsed. */
  isCollapsed?: boolean
  /** Lower clamp, e.g. "14rem". */
  minResizeWidth?: string
  /** Upper clamp, e.g. "22rem". */
  maxResizeWidth?: string
  /** Toggle the panel on a plain click (no drag). */
  enableToggle?: boolean
  /** Collapse an expanded panel once it is dragged far enough below the minimum. */
  enableAutoCollapse?: boolean
  /**
   * How far a collapse drag must travel, as a multiple of the minimum width.
   * `1.0` collapses right at the minimum; `1.5` requires dragging 50% beyond it.
   */
  autoCollapseThreshold?: number
  /** Fraction of the minimum width a collapsed panel must be dragged before it expands. */
  expandThreshold?: number
  /** Master switch for drag resizing. Clicks still toggle when this is off. */
  enableDrag?: boolean
  /** Notified when a drag begins/ends so the panel can suppress width transitions. */
  setIsDraggingRail?: (isDragging: boolean) => void
  /** Cookie that persists the chosen width across reloads. */
  widthCookieName?: string
  /** Width cookie lifetime, in seconds. */
  widthCookieMaxAge?: number
  /**
   * Element that owns the `--sidebar-width` custom property. While dragging, the
   * width is written straight to it for a lag-free track; reactive state and the
   * cookie are committed on pointer up.
   */
  resizeRootRef?: Ref<HTMLElement | null>
}

type WidthUnit = "rem" | "px"

const PIXELS_PER_REM = 16
const DRAG_START_THRESHOLD_PX = 5
const TOGGLE_COOLDOWN_MS = 200
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

function widthUnitOf(width: string): WidthUnit {
  return width.trim().endsWith("rem") ? "rem" : "px"
}

function toPixels(width: string): number {
  const value = Number.parseFloat(width)
  return widthUnitOf(width) === "rem" ? value * PIXELS_PER_REM : value
}

function formatWidth(pixels: number, unit: WidthUnit): string {
  return unit === "rem"
    ? `${(pixels / PIXELS_PER_REM).toFixed(1)}rem`
    : `${Math.round(pixels)}px`
}

function isIgnorablePointerCaptureError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotFoundError" || error.name === "InvalidStateError")
  )
}

function releasePointerCapture(target: HTMLElement, pointerId: number): void {
  try {
    target.releasePointerCapture(pointerId)
  } catch (error) {
    if (!isIgnorablePointerCaptureError(error)) {
      throw error
    }
  }
}

/**
 * Takes the options as a plain object OR a ref/getter: `currentWidth` and
 * `isCollapsed` change while the panel lives, and the handlers read them at
 * event time, so a getter keeps them current.
 */
export function useSidebarResize(options: MaybeRefOrGetter<UseSidebarResizeOptions>) {
  const o = () => {
    const v = toValue(options)
    return {
      direction: v.direction ?? "right",
      currentWidth: v.currentWidth,
      onResize: v.onResize,
      onToggle: v.onToggle,
      isCollapsed: v.isCollapsed ?? false,
      minResizeWidth: v.minResizeWidth ?? "14rem",
      maxResizeWidth: v.maxResizeWidth ?? "22rem",
      enableToggle: v.enableToggle ?? true,
      enableAutoCollapse: v.enableAutoCollapse ?? true,
      autoCollapseThreshold: v.autoCollapseThreshold ?? 1.5,
      expandThreshold: v.expandThreshold ?? 0.2,
      enableDrag: v.enableDrag ?? true,
      setIsDraggingRail: v.setIsDraggingRail,
      widthCookieName: v.widthCookieName,
      widthCookieMaxAge: v.widthCookieMaxAge ?? ONE_WEEK_SECONDS,
      resizeRootRef: v.resizeRootRef,
    }
  }

  const dragRef = ref<HTMLButtonElement | null>(null)
  let startX = 0
  let isDragging = false
  let isInteracting = false
  let activePointerId: number | null = null
  let pendingWidth: string | null = null
  let lastTogglePoint = 0
  let toggleCooldownUntil = 0
  let previousBodyUserSelect: string | null = null

  // A left-hand panel grows as the pointer moves right; a right-hand panel grows
  // as it moves left.
  const isExpandingDrag = (pointerX: number, referenceX: number): boolean =>
    o().direction === "left" ? pointerX < referenceX : pointerX > referenceX

  // Width implied by the pointer for an edge-anchored panel.
  const widthFromPointer = (pointerX: number): number =>
    o().direction === "left" ? window.innerWidth - pointerX : pointerX

  const clampWidthPx = (pixels: number): number =>
    Math.max(toPixels(o().minResizeWidth), Math.min(toPixels(o().maxResizeWidth), pixels))

  const persistWidth = (width: string): void => {
    const { widthCookieName, widthCookieMaxAge } = o()
    if (widthCookieName) {
      document.cookie = `${widthCookieName}=${width}; path=/; max-age=${widthCookieMaxAge}`
    }
  }

  const writeLiveWidth = (width: string): void => {
    o().resizeRootRef?.value?.style.setProperty("--sidebar-width", width)
  }

  const restoreBodyUserSelect = (): void => {
    if (previousBodyUserSelect !== null) {
      document.body.style.userSelect = previousBodyUserSelect
      previousBodyUserSelect = null
    }
  }

  const handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    isInteracting = true
    activePointerId = event.pointerId

    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch (error) {
      if (!isIgnorablePointerCaptureError(error)) {
        throw error
      }
    }

    if (!o().enableDrag) {
      return
    }

    startX = event.clientX
    lastTogglePoint = event.clientX
    toggleCooldownUntil = 0
    pendingWidth = null
    previousBodyUserSelect = document.body.style.userSelect
    document.body.style.userSelect = "none"
  }

  const handleDragMove = (pointerX: number, pointerId: number): void => {
    const {
      enableDrag, currentWidth, onResize, onToggle, isCollapsed, minResizeWidth,
      enableAutoCollapse, autoCollapseThreshold, expandThreshold, setIsDraggingRail, resizeRootRef,
    } = o()
    if (!isInteracting || !enableDrag) return
    if (activePointerId !== pointerId) return

    if (!isDragging) {
      if (Math.abs(pointerX - startX) <= DRAG_START_THRESHOLD_PX) return
      isDragging = true
      setIsDraggingRail?.(true)
    }

    const minWidthPx = toPixels(minResizeWidth)
    const unit = widthUnitOf(currentWidth)
    const now = Date.now()
    const draggingToExpand = isExpandingDrag(pointerX, lastTogglePoint)
    const pointerWidthPx = widthFromPointer(pointerX)

    if (onToggle && now >= toggleCooldownUntil) {
      // Collapse an expanded panel dragged far enough below the minimum.
      if (enableAutoCollapse && !isCollapsed && !draggingToExpand) {
        const collapseFloorPx =
          autoCollapseThreshold <= 1
            ? minWidthPx * autoCollapseThreshold
            : minWidthPx - minWidthPx * (autoCollapseThreshold - 1)

        if (pointerWidthPx <= collapseFloorPx) {
          onToggle()
          lastTogglePoint = pointerX
          toggleCooldownUntil = now + TOGGLE_COOLDOWN_MS
          return
        }
      }

      // Expand a collapsed panel once it is dragged back past the threshold.
      if (
        isCollapsed &&
        draggingToExpand &&
        Math.abs(pointerX - lastTogglePoint) > minWidthPx * expandThreshold
      ) {
        onToggle()
        const width = formatWidth(clampWidthPx(pointerWidthPx), unit)
        pendingWidth = width
        writeLiveWidth(width)
        onResize(width)
        persistWidth(width)
        lastTogglePoint = pointerX
        toggleCooldownUntil = now + TOGGLE_COOLDOWN_MS
        return
      }
    }

    if (isCollapsed) return

    const width = formatWidth(clampWidthPx(pointerWidthPx), unit)
    const startedDragging = pendingWidth === null
    pendingWidth = width
    writeLiveWidth(width)
    // Sync reactive state once, at drag start, then let the DOM writes above
    // carry the drag with no re-render. Without a live root to write to, commit
    // every frame so the width still tracks.
    if (startedDragging || !resizeRootRef?.value) {
      onResize(width)
    }
  }

  const finishInteraction = (pointerId: number, allowToggleClick: boolean): void => {
    if (!isInteracting) return
    if (activePointerId !== pointerId) return
    const { enableToggle, onToggle, onResize, setIsDraggingRail } = o()

    const rail = dragRef.value
    if (rail?.hasPointerCapture(pointerId)) {
      releasePointerCapture(rail, pointerId)
    }

    if (allowToggleClick && !isDragging && enableToggle && onToggle) {
      onToggle()
    }

    if (isDragging && pendingWidth) {
      onResize(pendingWidth)
      persistWidth(pendingWidth)
    }

    isDragging = false
    isInteracting = false
    activePointerId = null
    pendingWidth = null
    lastTogglePoint = 0
    toggleCooldownUntil = 0
    restoreBodyUserSelect()
    setIsDraggingRail?.(false)
  }

  const onPointerMove = (event: PointerEvent) => handleDragMove(event.clientX, event.pointerId)
  const onPointerUp = (event: PointerEvent) => finishInteraction(event.pointerId, true)
  const onPointerCancel = (event: PointerEvent) => finishInteraction(event.pointerId, false)

  onMounted(() => {
    document.addEventListener("pointermove", onPointerMove)
    document.addEventListener("pointerup", onPointerUp)
    document.addEventListener("pointercancel", onPointerCancel)
  })
  onBeforeUnmount(() => {
    document.removeEventListener("pointermove", onPointerMove)
    document.removeEventListener("pointerup", onPointerUp)
    document.removeEventListener("pointercancel", onPointerCancel)
    restoreBodyUserSelect()
  })

  return { dragRef, handlePointerDown }
}
