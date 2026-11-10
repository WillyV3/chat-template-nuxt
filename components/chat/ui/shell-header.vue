<script setup lang="ts">
import type { HTMLAttributes } from "vue"

/** The top row every column opens with, so the rail, the stage and the right
 *  panel share one line. Hosts put it at the top of their sidebar content;
 *  ChatShell draws it for `header` and `rightHeader`. */
const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), { class: "" })
</script>

<template>
  <div :class="['flex h-12 shrink-0 items-center gap-2 px-3', props.class]">
    <slot />
  </div>
</template>
