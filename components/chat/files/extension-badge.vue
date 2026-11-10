<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const props = defineProps<{
  ext: string
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Badge
    v-if="!ext"
    variant="outline"
    :class="cn('rounded-md font-mono text-[9px] uppercase tracking-wider', props.class)"
  >
    •
  </Badge>
  <Badge
    v-else
    variant="secondary"
    :class="cn('rounded-md font-mono uppercase tracking-wider', props.class)"
  >
    {{ ext }}
  </Badge>
</template>
