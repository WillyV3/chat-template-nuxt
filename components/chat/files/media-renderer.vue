<script setup lang="ts">
import { ref } from "vue"
import DownloadCard from "./download-card.vue"
import type { FileEntry } from "./file-viewer"

defineProps<{
  blobUrl: string
  kind: "video" | "audio"
  file: FileEntry
  onDownload: () => void
}>()

const failed = ref(false)
</script>

<template>
  <DownloadCard v-if="failed" :file="file" :on-download="onDownload" failed />
  <div v-else class="flex h-full items-center justify-center bg-muted/20 px-6 py-8">
    <video
      v-if="kind === 'video'"
      :src="blobUrl"
      controls
      playsinline
      class="max-h-full max-w-full rounded-lg shadow-2xl shadow-black/20"
      @error="failed = true"
    />
    <audio
      v-else
      :src="blobUrl"
      controls
      class="w-full max-w-md"
      @error="failed = true"
    />
  </div>
</template>
