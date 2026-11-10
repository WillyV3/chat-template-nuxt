<script setup lang="ts">
import { Loader2 } from "@lucide/vue"

defineProps<{ label: string }>()
</script>

<template>
  <div class="flex items-center gap-2 px-6 py-10 text-xs text-muted-foreground">
    <Loader2 class="size-3.5 animate-spin" /> {{ label }}
  </div>
</template>
