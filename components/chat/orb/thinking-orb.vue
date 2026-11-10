<script setup lang="ts">
// Vue port of `thinking-orbs` 0.2.0's <ThinkingOrb> (MIT, (c) 2026 Jakub
// Antalik; full notice in ./modes.ts). Same canvas pipeline: DPR capped at 2,
// rAF paused offscreen (IntersectionObserver) and on hidden tabs, frozen frame
// under prefers-reduced-motion, `auto` theme resolved from a data-theme / dark
// / light ancestor with a live MutationObserver, then matchMedia.
import { onMounted, ref, shallowRef, watchEffect } from "vue";

import {
  MODE_DRAWS,
  ORB_ARIA_LABELS,
  resolvePreset,
  type OrbSize,
  type OrbState,
  type OrbTheme,
} from "./modes";

const props = withDefaults(
  defineProps<{
    /** Which animation to show. */
    state?: OrbState;
    /** Tuned size preset: 64 or 20 CSS px. */
    size?: OrbSize;
    /** Theme mode; `auto` detects from the host project. */
    theme?: OrbTheme;
    /** Speed multiplier on top of the preset's baked speed. */
    speed?: number;
    /** Freeze the animation on the current frame. */
    paused?: boolean;
    ariaLabel?: string;
  }>(),
  { state: "working", size: 64, theme: "auto", speed: 1, paused: false },
);

const canvas = shallowRef<HTMLCanvasElement | null>(null);
// First client render resolves before anything is painted (the canvas is
// client-only), so the default only matters for SSR markup, which has no pixels.
const isDark = ref(true);
const reduced = ref(false);

/** A `data-theme` attribute or `dark`/`light` class on the element or any ancestor. */
function themeFromAncestors(el: HTMLElement | null): boolean | null {
  let n: HTMLElement | null = el;
  while (n) {
    const dt = n.getAttribute("data-theme");
    if (dt === "dark") return true;
    if (dt === "light") return false;
    if (n.classList.contains("dark")) return true;
    if (n.classList.contains("light")) return false;
    n = n.parentElement;
  }
  return null;
}

const osPrefersDark = () =>
  typeof matchMedia === "undefined" || matchMedia("(prefers-color-scheme: dark)").matches;

onMounted(() => {
  // Theme: pinned, or auto-resolved and kept live.
  watchEffect((onCleanup) => {
    if (props.theme === "dark") {
      isDark.value = true;
      return;
    }
    if (props.theme === "light") {
      isDark.value = false;
      return;
    }
    const resolve = () => {
      isDark.value = themeFromAncestors(canvas.value) ?? osPrefersDark();
    };
    resolve();
    const mq = typeof matchMedia !== "undefined" ? matchMedia("(prefers-color-scheme: dark)") : null;
    mq?.addEventListener("change", resolve);
    let mo: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && canvas.value) {
      mo = new MutationObserver(resolve);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
        subtree: true,
      });
    }
    onCleanup(() => {
      mq?.removeEventListener("change", resolve);
      mo?.disconnect();
    });
  });

  // Reduced motion: draw one still frame instead of animating.
  watchEffect((onCleanup) => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reduced.value = mq.matches;
    const on = (e: MediaQueryListEvent) => (reduced.value = e.matches);
    mq.addEventListener("change", on);
    onCleanup(() => mq.removeEventListener("change", on));
  });

  // Draw loop: re-runs (cleaning up the previous one) when any input changes.
  watchEffect((onCleanup) => {
    const el = canvas.value;
    if (!el) return;
    const { state, size, speed, paused } = props;
    const dark = isDark.value;
    const still = reduced.value;
    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    el.width = Math.round(size * dpr);
    el.height = Math.round(size * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const { mode, speed: presetSpeed, opts } = resolvePreset(state, size);
    const draw = MODE_DRAWS[mode];
    const rate = presetSpeed * speed;
    const frame = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      draw(ctx, size, t, dark, opts);
    };
    if (still) {
      frame(0.6);
      return;
    }
    let raf = 0;
    let running = false;
    const tick = () => {
      frame((performance.now() / 1000) * rate);
      if (running) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || paused) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    frame((performance.now() / 1000) * rate);
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== "hidden") start();
            else stop();
          })
        : null;
    io?.observe(el);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!io) start();
    onCleanup(() => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    });
  });
});
</script>

<template>
  <canvas
    ref="canvas"
    role="img"
    :aria-label="ariaLabel ?? ORB_ARIA_LABELS[state]"
    :style="{ width: `${size}px`, height: `${size}px`, display: 'block' }"
  />
</template>
