<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { useStickToBottomContext } from "./conversation"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  scrollClass?: HTMLAttributes["class"]
}>()
const ctx = useStickToBottomContext()
</script>

<template>
  <div
    :ref="ctx.setScrollEl"
    :style="{ height: '100%', width: '100%', scrollbarGutter: 'stable both-edges' }"
    :class="props.scrollClass"
  >
    <div :ref="ctx.setContentEl" :class="cn('p-4', props.class)">
      <slot :context="ctx" />
    </div>
  </div>
</template>
