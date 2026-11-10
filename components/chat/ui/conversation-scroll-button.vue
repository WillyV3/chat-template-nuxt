<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ArrowDownIcon } from "@lucide/vue"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useStickToBottomContext } from "./conversation"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
const ctx = useStickToBottomContext()
</script>

<template>
  <Button
    v-if="!ctx.isAtBottom.value"
    :class="cn('bg-background dark:bg-background absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full shadow-md', props.class)"
    size="icon"
    type="button"
    variant="outline"
    aria-label="Scroll to bottom"
    @click="ctx.scrollToBottom()"
  >
    <ArrowDownIcon class="size-4" />
  </Button>
</template>
