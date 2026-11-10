<script setup lang="ts">
/** .txt (and unknown text) reads like a note, not a terminal: the app's sans
 *  face, comfortable measure, generous padding. Mono is only for logs/code. */
defineProps<{ text: string }>()
</script>

<template>
  <div class="mx-auto max-w-prose px-6 py-10 sm:px-10">
    <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">{{ text }}</p>
  </div>
</template>
