<script setup lang="ts">
import PdfFrame from "./pdf-frame.vue"

defineProps<{ blobUrl: string; kind: "image" | "pdf"; alt: string }>()
</script>

<template>
  <div v-if="kind === 'image'" class="flex h-full items-center justify-center bg-muted/20 px-6 py-8">
    <img
      :src="blobUrl"
      :alt="alt"
      class="max-h-full max-w-full rounded-lg shadow-2xl shadow-black/20"
    />
  </div>
  <PdfFrame v-else :blob-url="blobUrl" :title="alt" />
</template>
