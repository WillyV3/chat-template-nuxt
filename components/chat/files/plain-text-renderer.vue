<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <pre class="whitespace-pre-wrap break-words px-6 py-6 font-mono text-xs leading-relaxed text-foreground/90">{{ text }}</pre>
</template>
