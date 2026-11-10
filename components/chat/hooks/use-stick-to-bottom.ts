// Vue port of use-stick-to-bottom (StackBlitz, MIT). Same semantics as the
// React lib: stick while at bottom (spring-animated as content grows), release
// when the user scrolls/wheels up or selects text, re-stick when they scroll
// back near the bottom, and expose scrollToBottom for the button.
//
// The lib kept its mutable `state` object in a useMemo; here it is a plain
// object in the composable closure. Only isAtBottom / isNearBottom /
// escapedFromLock are reactive (they drive the scroll button).

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from "vue";

export interface SpringAnimation {
  /** 0..1, how much to damp the animation. @default 0.7 */
  damping: number;
  /** How fast the animation gets up to speed. @default 0.05 */
  stiffness: number;
  /** Inertial mass; higher is slower. @default 1.25 */
  mass: number;
}

export type Animation = "instant" | "smooth" | Partial<SpringAnimation>;

export interface ScrollElements {
  scrollElement: HTMLElement;
  contentElement: HTMLElement;
}
export type GetTargetScrollTop = (targetScrollTop: number, elements: ScrollElements) => number;

export interface StickToBottomOptions extends Partial<SpringAnimation> {
  resize?: Animation;
  initial?: Animation | boolean;
  targetScrollTop?: GetTargetScrollTop;
}

export type ScrollToBottomOptions =
  | "instant"
  | "smooth"
  | {
      animation?: Animation;
      /** true = wait for the current animation instead of replacing it. */
      wait?: boolean | number;
      ignoreEscapes?: boolean;
      preserveScrollPosition?: boolean;
      duration?: number | Promise<unknown>;
    };

const DEFAULT_SPRING_ANIMATION: SpringAnimation = { damping: 0.7, stiffness: 0.05, mass: 1.25 };
const STICK_TO_BOTTOM_OFFSET_PX = 70;
const SIXTY_FPS_INTERVAL_MS = 1000 / 60;
const RETAIN_ANIMATION_DURATION_MS = 350;

let mouseDown = false;
if (typeof document !== "undefined") {
  document.addEventListener("mousedown", () => {
    mouseDown = true;
  });
  document.addEventListener("mouseup", () => {
    mouseDown = false;
  });
  document.addEventListener("click", () => {
    mouseDown = false;
  });
}

type Behavior = "instant" | Readonly<SpringAnimation>;

interface StickState {
  escapedFromLock: boolean;
  isAtBottom: boolean;
  resizeDifference: number;
  accumulated: number;
  velocity: number;
  scrollTop: number;
  readonly targetScrollTop: number;
  readonly calculatedTargetScrollTop: number;
  readonly scrollDifference: number;
  readonly isNearBottom: boolean;
  ignoreScrollToTop?: number;
  lastScrollTop?: number;
  lastTick?: number;
  animation?: { behavior: Behavior; promise: Promise<boolean>; ignoreEscapes: boolean };
  resizeObserver?: ResizeObserver;
}

export interface StickToBottomContext {
  scrollToBottom: (options?: ScrollToBottomOptions) => Promise<boolean>;
  stopScroll: () => void;
  scrollRef: { current: HTMLElement | null };
  contentRef: { current: HTMLElement | null };
  /** Function refs for the two elements (Vue: `:ref="ctx.setScrollEl"`). */
  setScrollEl: (el: unknown) => void;
  setContentEl: (el: unknown) => void;
  isAtBottom: ComputedRef<boolean>;
  escapedFromLock: Ref<boolean>;
  state: StickState;
  targetScrollTop: GetTargetScrollTop | null;
}

const animationCache = new Map<string, Readonly<SpringAnimation>>();

function mergeAnimations(...animations: unknown[]): Behavior {
  const result: SpringAnimation = { ...DEFAULT_SPRING_ANIMATION };
  let instant = false;
  for (const animation of animations) {
    if (animation === "instant") {
      instant = true;
      continue;
    }
    if (typeof animation !== "object" || animation === null) continue;
    instant = false;
    const a = animation as Partial<SpringAnimation>;
    result.damping = a.damping ?? result.damping;
    result.stiffness = a.stiffness ?? result.stiffness;
    result.mass = a.mass ?? result.mass;
  }
  const key = JSON.stringify(result);
  if (!animationCache.has(key)) animationCache.set(key, Object.freeze(result));
  return instant ? "instant" : animationCache.get(key)!;
}

export function useStickToBottom(optionsInput: MaybeRefOrGetter<StickToBottomOptions> = {}) {
  const options = () => toValue(optionsInput);
  const escapedFromLock = ref(false);
  const isAtBottom = ref(options().initial !== false);
  const isNearBottom = ref(false);

  const scrollRef: { current: HTMLElement | null } = { current: null };
  const contentRef: { current: HTMLElement | null } = { current: null };

  const isSelecting = () => {
    if (!mouseDown) return false;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    return (
      range.commonAncestorContainer.contains(scrollRef.current) ||
      !!scrollRef.current?.contains(range.commonAncestorContainer)
    );
  };

  const setIsAtBottom = (v: boolean) => {
    state.isAtBottom = v;
    isAtBottom.value = v;
  };
  const setEscapedFromLock = (v: boolean) => {
    state.escapedFromLock = v;
    escapedFromLock.value = v;
  };

  let lastCalculation: { targetScrollTop: number; calculatedScrollTop: number } | undefined;

  const state: StickState = {
    escapedFromLock: escapedFromLock.value,
    isAtBottom: isAtBottom.value,
    resizeDifference: 0,
    accumulated: 0,
    velocity: 0,
    get scrollTop() {
      return scrollRef.current?.scrollTop ?? 0;
    },
    set scrollTop(scrollTop: number) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollTop;
        state.ignoreScrollToTop = scrollRef.current.scrollTop;
      }
    },
    get targetScrollTop() {
      if (!scrollRef.current || !contentRef.current) return 0;
      return scrollRef.current.scrollHeight - 1 - scrollRef.current.clientHeight;
    },
    get calculatedTargetScrollTop() {
      if (!scrollRef.current || !contentRef.current) return 0;
      const { targetScrollTop } = state;
      const custom = options().targetScrollTop;
      if (!custom) return targetScrollTop;
      if (lastCalculation?.targetScrollTop === targetScrollTop) return lastCalculation.calculatedScrollTop;
      const calculatedScrollTop = Math.max(
        Math.min(
          custom(targetScrollTop, { scrollElement: scrollRef.current, contentElement: contentRef.current }),
          targetScrollTop,
        ),
        0,
      );
      lastCalculation = { targetScrollTop, calculatedScrollTop };
      requestAnimationFrame(() => {
        lastCalculation = undefined;
      });
      return calculatedScrollTop;
    },
    get scrollDifference() {
      return state.calculatedTargetScrollTop - state.scrollTop;
    },
    get isNearBottom() {
      return state.scrollDifference <= STICK_TO_BOTTOM_OFFSET_PX;
    },
  };

  const scrollToBottom = (scrollOptionsIn: ScrollToBottomOptions = {}): Promise<boolean> => {
    const scrollOptions: Exclude<ScrollToBottomOptions, string> =
      typeof scrollOptionsIn === "string" ? { animation: scrollOptionsIn } : scrollOptionsIn;

    if (!scrollOptions.preserveScrollPosition) setIsAtBottom(true);

    const waitElapsed = Date.now() + (Number(scrollOptions.wait) || 0);
    const behavior = mergeAnimations(options(), scrollOptions.animation);
    const { ignoreEscapes = false } = scrollOptions;

    let durationElapsed: number | undefined;
    let startTarget = state.calculatedTargetScrollTop;

    if (scrollOptions.duration instanceof Promise) {
      void scrollOptions.duration.finally(() => {
        durationElapsed = Date.now();
      });
    } else {
      durationElapsed = waitElapsed + (scrollOptions.duration ?? 0);
    }

    const next = async (): Promise<boolean> => {
      const promise: Promise<boolean> = new Promise<number>((resolve) => requestAnimationFrame(resolve)).then((): boolean | Promise<boolean> => {
        if (!state.isAtBottom) {
          state.animation = undefined;
          return false;
        }

        const { scrollTop } = state;
        const tick = performance.now();
        const tickDelta = (tick - (state.lastTick ?? tick)) / SIXTY_FPS_INTERVAL_MS;
        state.animation ||= { behavior, promise, ignoreEscapes };

        if (state.animation.behavior === behavior) state.lastTick = tick;

        if (isSelecting()) return next();
        if (waitElapsed > Date.now()) return next();

        if (scrollTop < Math.min(startTarget, state.calculatedTargetScrollTop)) {
          if (state.animation?.behavior === behavior) {
            if (behavior === "instant") {
              state.scrollTop = state.calculatedTargetScrollTop;
              return next();
            }

            state.velocity =
              (behavior.damping * state.velocity + behavior.stiffness * state.scrollDifference) / behavior.mass;
            state.accumulated += state.velocity * tickDelta;
            state.scrollTop += state.accumulated;

            if (state.scrollTop !== scrollTop) state.accumulated = 0;
          }
          return next();
        }

        if ((durationElapsed ?? 0) > Date.now()) {
          startTarget = state.calculatedTargetScrollTop;
          return next();
        }

        state.animation = undefined;

        // If we're still below the target, then queue up another scroll to the
        // bottom with the last requested animation.
        if (state.scrollTop < state.calculatedTargetScrollTop) {
          return scrollToBottom({
            animation: mergeAnimations(options(), options().resize) as Animation,
            ignoreEscapes,
            duration: Math.max(0, (durationElapsed ?? 0) - Date.now()) || undefined,
          });
        }

        return state.isAtBottom;
      });

      return promise.then((atBottom) => {
        requestAnimationFrame(() => {
          if (!state.animation) {
            state.lastTick = undefined;
            state.velocity = 0;
          }
        });
        return atBottom;
      });
    };

    if (scrollOptions.wait !== true) state.animation = undefined;

    if (state.animation?.behavior === behavior) return state.animation.promise;

    return next();
  };

  const stopScroll = () => {
    setEscapedFromLock(true);
    setIsAtBottom(false);
  };

  const handleScroll = (event: Event) => {
    if (event.target !== scrollRef.current) return;

    const { scrollTop, ignoreScrollToTop } = state;
    let { lastScrollTop = scrollTop } = state;

    state.lastScrollTop = scrollTop;
    state.ignoreScrollToTop = undefined;

    if (ignoreScrollToTop && ignoreScrollToTop > scrollTop) {
      // When the user scrolls up while the animation plays, the `scrollTop` may
      // not come in separate events; if this happens, to make sure
      // `isScrollingUp` is correct, set the lastScrollTop to the ignored event.
      lastScrollTop = ignoreScrollToTop;
    }

    isNearBottom.value = state.isNearBottom;

    // Scroll events may come before a ResizeObserver event, so in order to
    // ignore resize events correctly we use a timeout.
    // See https://github.com/WICG/resize-observer/issues/25#issuecomment-248757228
    setTimeout(() => {
      // When there's a resize difference ignore the resize event.
      if (state.resizeDifference || scrollTop === ignoreScrollToTop) return;

      if (isSelecting()) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
        return;
      }

      const isScrollingDown = scrollTop > lastScrollTop;
      const isScrollingUp = scrollTop < lastScrollTop;

      if (state.animation?.ignoreEscapes) {
        state.scrollTop = lastScrollTop;
        return;
      }

      if (isScrollingUp) {
        setEscapedFromLock(true);
        setIsAtBottom(false);
      }
      if (isScrollingDown) setEscapedFromLock(false);
      if (!state.escapedFromLock && state.isNearBottom) setIsAtBottom(true);
    }, 1);
  };

  const handleWheel = ({ target, deltaY }: WheelEvent) => {
    let element = target as HTMLElement | null;
    while (element && !["scroll", "auto"].includes(getComputedStyle(element).overflow)) {
      if (!element.parentElement) return;
      element = element.parentElement;
    }

    // The browser may cancel the scrolling from the mouse wheel if we update it
    // from the animation in meantime. To prevent this, always escape when the
    // wheel is scrolled up.
    if (
      element &&
      element === scrollRef.current &&
      deltaY < 0 &&
      scrollRef.current.scrollHeight > scrollRef.current.clientHeight &&
      !state.animation?.ignoreEscapes
    ) {
      setEscapedFromLock(true);
      setIsAtBottom(false);
    }
  };

  const setScrollEl = (el: unknown) => {
    scrollRef.current?.removeEventListener("scroll", handleScroll);
    scrollRef.current?.removeEventListener("wheel", handleWheel);
    const scroll = (el as HTMLElement | null) ?? null;
    scrollRef.current = scroll;
    scroll?.addEventListener("scroll", handleScroll, { passive: true });
    scroll?.addEventListener("wheel", handleWheel, { passive: true });
  };

  const setContentEl = (el: unknown) => {
    state.resizeObserver?.disconnect();
    const content = (el as HTMLElement | null) ?? null;
    contentRef.current = content;
    if (!content) return;

    let previousHeight: number | undefined;
    state.resizeObserver = new ResizeObserver(([entry]) => {
      const { height } = entry!.contentRect;
      const difference = height - (previousHeight ?? height);

      state.resizeDifference = difference;

      // Sometimes the browser can overscroll past the target, so check for this
      // and adjust appropriately.
      if (state.scrollTop > state.targetScrollTop) state.scrollTop = state.targetScrollTop;

      isNearBottom.value = state.isNearBottom;

      if (difference >= 0) {
        // If it's a positive resize, scroll to the bottom when we're already at
        // the bottom.
        const animation = mergeAnimations(options(), previousHeight ? options().resize : options().initial);

        void scrollToBottom({
          animation: animation as Animation,
          wait: true,
          preserveScrollPosition: true,
          duration: animation === "instant" ? undefined : RETAIN_ANIMATION_DURATION_MS,
        });
      } else if (state.isNearBottom) {
        // Else if it's a negative resize, check if we're near the bottom; if we
        // are want to un-escape from the lock, because the resize could have
        // caused the container to be at the bottom.
        setEscapedFromLock(false);
        setIsAtBottom(true);
      }

      previousHeight = height;

      // Reset the resize difference after the scroll event has fired. Requires a
      // rAF to wait for the scroll event, and a setTimeout to wait for the other
      // timeout we have in resizeObserver in case the scroll event happens after
      // the resize event.
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (state.resizeDifference === difference) state.resizeDifference = 0;
        }, 1);
      });
    });

    state.resizeObserver.observe(content);
  };

  return {
    scrollRef,
    contentRef,
    setScrollEl,
    setContentEl,
    scrollToBottom,
    stopScroll,
    isAtBottom: computed(() => isAtBottom.value || isNearBottom.value),
    isNearBottom,
    escapedFromLock,
    state,
  };
}
