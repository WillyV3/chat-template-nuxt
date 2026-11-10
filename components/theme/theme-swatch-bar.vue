<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

// `class` overrides the default full-width tile size — e.g. a compact inline
// row in the preset dropdown (`h-4 w-12`). twMerge lets it win over the defaults.
const props = defineProps<{ swatch: string[]; class?: HTMLAttributes["class"] }>();
</script>

<template>
  <span :class="cn('flex h-10 w-full overflow-hidden rounded-md border border-border/50', props.class)">
    <span v-for="(c, i) in swatch" :key="i" class="flex-1" :style="{ background: c }" />
  </span>
</template>
