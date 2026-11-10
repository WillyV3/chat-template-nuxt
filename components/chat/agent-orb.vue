<script setup lang="ts">
// The agent's status orb, in Sontara's clothes.
//
// Wraps the ported `thinking-orbs` (components/chat/orb/) so the rest of the
// app never touches the library directly: sizing, the surface it sits on, the
// label beside it and the reduced-motion rule are decided ONCE, here. Swapping
// or upgrading the library is then a change to this file plus lib/orb-state.ts.
//
// SIZE IS NOT A SCALE FACTOR. The package ships exactly two tuned presets: 64
// and 20, each with its own dot count, dot size and speed. They are separate
// designs, so this component exposes those two and nothing in between.
//
// THEME: the orb's `auto` resolves from a `data-theme` attribute or a
// `dark`/`light` class on any ancestor (the shadcn convention we already use)
// and live-updates via MutationObserver, so it follows our theme toggle with
// no wiring. Passing an explicit theme would break that.
import type { HTMLAttributes } from "vue";

import { usePrefersReducedMotion } from "@/components/chat/hooks/use-media-query";
import ThinkingOrb from "@/components/chat/orb/thinking-orb.vue";
import type { OrbState } from "@/components/chat/orb/modes";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    state: OrbState;
    /** 20 = inline with text, 64 = the standalone thinking bubble. */
    size?: 64 | 20;
    /** "brand" = Sontara teal (the standalone thinking-bubble orb, the one
     *  that reads as THE agent); "mono" = theme black/white (orbs inline in
     *  rows, chips and cards). Keyed on intent, not size: every rendered orb
     *  is the 20 preset today, so a size key colors nothing (2026-08-11). */
    tone?: "brand" | "mono";
    /** Screen-reader text AND the visible caption when one is wanted. The orb is
     *  an animation; a person using a screen reader gets the words. */
    label?: string;
    class?: HTMLAttributes["class"];
  }>(),
  { size: 20, tone: "mono" },
);

// The orb animates on a canvas via requestAnimationFrame, so a
// `motion-reduce:` utility class cannot touch it: CSS does not reach inside
// the canvas. The orb's own `paused` prop is the only thing that does.
// Freezing beats hiding: the still frame still shows WHICH state the agent
// is in, so the information survives even when the motion does not.
const reducedMotion = usePrefersReducedMotion();
</script>

<template>
  <span :class="cn('inline-flex items-center gap-2', props.class)">
    <!-- The library draws baked black/white dots on canvas with no color
         prop, so brand tone is a filter: brightness(0) flattens either
         theme's dots to black (alpha kept), the rest rotates black to teal,
         theme-independent by construction. -->
    <ThinkingOrb
      :state="state"
      :size="size"
      :paused="reducedMotion"
      :class="
        cn(
          'shrink-0',
          tone === 'brand' &&
            '[filter:brightness(0)_saturate(100%)_invert(45%)_sepia(89%)_saturate(2334%)_hue-rotate(155deg)_brightness(91%)_contrast(101%)]',
        )
      "
      :aria-label="label ?? `Agent is ${state}`"
    />
    <span v-if="label" class="font-serif text-[15px] italic text-muted-foreground">
      {{ label }}
    </span>
  </span>
</template>
