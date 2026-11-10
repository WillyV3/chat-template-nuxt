<script setup lang="ts">
import Response from "@/components/chat/ui/response.vue"
import { cn } from "@/lib/utils"
import { MARKDOWN_PROSE_CLASSES } from "./file-viewer"

defineProps<{ text: string }>()
</script>

<template>
  <article :class="cn('mx-auto max-w-[72ch] px-6 py-10 sm:px-10', MARKDOWN_PROSE_CLASSES)">
    <Response :content="text" />
  </article>
</template>
