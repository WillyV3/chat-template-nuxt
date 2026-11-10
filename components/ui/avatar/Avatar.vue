<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { AvatarRoot } from "reka-ui"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  size?: "default" | "sm" | "lg"
}>(), { size: "default" })
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    :data-size="props.size"
    :class="cn('group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6', props.class)"
  >
    <slot />
  </AvatarRoot>
</template>
