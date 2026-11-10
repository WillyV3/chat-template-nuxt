<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";

const props = defineProps<{
  from: "user" | "assistant";
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'group flex w-full items-end gap-2 py-4',
        props.from === 'user' ? 'is-user flex-row-reverse' : 'is-assistant',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
