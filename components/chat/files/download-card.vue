<script setup lang="ts">
/** Honest, plain-language card for anything we can't (or couldn't) preview.
 *  `failed` swaps the type hint for one calm renderer-failure line. */
import { computed } from "vue"
import { Download, FileText } from "@lucide/vue"
import { formatSize, getExtension, type FileEntry } from "./file-viewer"
import { describeFileType, PREVIEW_FAILED_HINT } from "./viewer-model"

const props = defineProps<{
  file: FileEntry
  onDownload: () => void
  failed?: boolean
}>()

const card = computed(() => describeFileType(getExtension(props.file.name)))
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <FileText class="size-10 text-muted-foreground" />
    <div class="text-sm font-medium break-all">{{ file.name }}</div>
    <div class="text-xs text-muted-foreground">
      {{ card.label }} · {{ formatSize(file.size) }}
    </div>
    <div class="max-w-xs text-xs text-muted-foreground">
      {{ failed ? PREVIEW_FAILED_HINT : card.hint }}
    </div>
    <button
      class="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      @click="onDownload()"
    >
      <Download class="size-3.5" /> Download
    </button>
  </div>
</template>
