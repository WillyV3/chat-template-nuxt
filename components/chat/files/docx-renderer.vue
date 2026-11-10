<script setup lang="ts">
import { ref, watch } from "vue"
import { cn } from "@/lib/utils"
import DownloadCard from "./download-card.vue"
import InlineLoader from "./inline-loader.vue"
import { interopDefault, MARKDOWN_PROSE_CLASSES, type FileEntry } from "./file-viewer"

const props = defineProps<{
  url: string
  token: string
  file: FileEntry
  onDownload: () => void
}>()

const html = ref<string | null>(null)
const failed = ref(false)

watch(
  () => [props.url, props.token] as const,
  ([url, token], _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    html.value = null
    failed.value = false
    ;(async () => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      // Lazy: mammoth only loads when a .docx is actually opened.
      const mammoth = interopDefault(await import("mammoth"))
      const out = await mammoth.convertToHtml({ arrayBuffer: buf })
      if (!cancelled) html.value = out.value
    })().catch(() => {
      if (!cancelled) failed.value = true
    })
  },
  { immediate: true },
)
</script>

<template>
  <DownloadCard v-if="failed" :file="file" :on-download="onDownload" failed />
  <InlineLoader v-else-if="html === null" label="Preparing document…" />
  <!-- mammoth builds this HTML from the docx XML via a fixed transform — no
       scripts by construction; images arrive as inline data: URIs. -->
  <article
    v-else
    :class="cn('mx-auto max-w-[72ch] px-6 py-10 sm:px-10', MARKDOWN_PROSE_CLASSES)"
    v-html="html"
  />
</template>
