<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const messageContentVariants = cva(
  // rounded-2xl + overflow-hidden live on the VISIBLE-bubble variants only.
  // On the base they put an invisible rounded clip mask on transparent
  // assistant messages too, shaving glyph corners (Willy 2026-07-23).
  // min-w-0 is load-bearing, not tidiness. This is a flex ITEM inside
  // <Message>'s flex row, and a flex item defaults to `min-width: auto`: it
  // refuses to shrink below its content's intrinsic width. The user variant is
  // capped by max-w-[80%], but the ASSISTANT variant has no cap, so one wide
  // thing in a markdown reply (a table, a long code line, an unbroken URL)
  // pushed this past the row, past `w-full`, and the whole conversation
  // scrolled sideways on a phone.
  "is-user:dark flex min-w-0 flex-col gap-2 text-sm",
  {
    variants: {
      variant: {
        contained: [
          "max-w-[80%] overflow-hidden rounded-2xl px-4 py-3",
          "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
          // Pair bg-secondary with text-SECONDARY-foreground, not the page
          // foreground: a theme where `secondary` is a mid/dark tone gave
          // dark-on-dark bubbles (Willy 2026-08-11). The pair is the contract.
          "group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-secondary-foreground",
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:overflow-hidden group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-secondary-foreground",
          "group-[.is-assistant]:text-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  },
);

const props = defineProps<{
  variant?: "contained" | "flat";
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div :class="cn(messageContentVariants({ variant: props.variant, class: props.class }))">
    <slot />
  </div>
</template>
