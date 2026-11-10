<script setup lang="ts">
// PDFs render with pdf.js to canvas — the iframe path relied on the browser's
// PDF plugin, which mobile browsers don't have (iOS shows a blank frame for
// blob: PDFs; Willy hit exactly that, 2026-08-09). pdf.js paints identically
// everywhere. Pages render lazily as they scroll into view, so a 300-page
// report costs one page up front. Office docs converted via docpreview ride
// the same path. If pdf.js itself fails, the old iframe is the fallback —
// desktop plugins can still take a swing at a file pdf.js chokes on.
import { ref, shallowRef, watch, onBeforeUnmount } from "vue"
import InlineLoader from "./inline-loader.vue"
import PdfPage from "./pdf-page.vue"
import type { PdfDocHolder, PdfPageInfo } from "./pdf-page.vue"

const props = defineProps<{ blobUrl: string; title: string }>()

// PDFDocumentProxy from pdfjs-dist; typed loosely to keep the lib fully
// dynamic (same discipline as mammoth/exceljs — main bundle never pays).
// destroy() lives on the loading TASK in pdf.js 6.x, not the document.
const docHolder: PdfDocHolder = { current: null }
let destroy: (() => void) | null = null
const pages = shallowRef<PdfPageInfo[] | null>(null)
const failed = ref(false)

function teardown() {
  destroy?.()
  destroy = null
  docHolder.current = null
}

watch(
  () => props.blobUrl,
  (blobUrl, _old, onCleanup) => {
    let cancel = false
    onCleanup(() => {
      cancel = true
      teardown()
    })
    pages.value = null
    failed.value = false
    ;(async () => {
      try {
        const pdfjs = await import("pdfjs-dist")
        // Vite resolves `?url` to the emitted worker asset (dev + build).
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const task = pdfjs.getDocument({ url: blobUrl })
        destroy = () => void task.destroy()
        const doc = await task.promise
        if (cancel) return
        docHolder.current = doc
        // First page's aspect ratio sizes every placeholder; mixed-size
        // documents correct themselves as each page renders.
        const first = await doc.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        if (cancel) return
        pages.value = Array.from({ length: doc.numPages }, (_, i) => ({
          pageNumber: i + 1,
          aspect: vp.width / vp.height,
        }))
      } catch {
        if (!cancel) failed.value = true
      }
    })()
  },
  { immediate: true },
)

onBeforeUnmount(teardown)
</script>

<template>
  <div v-if="failed" class="h-full w-full bg-muted/30">
    <iframe :src="blobUrl" :title="title" class="h-full w-full border-0" />
  </div>
  <InlineLoader v-else-if="!pages" label="Opening PDF…" />
  <div v-else class="h-full w-full overflow-y-auto bg-muted/30 px-2 py-3 sm:px-4">
    <div class="mx-auto flex max-w-3xl flex-col gap-3">
      <PdfPage v-for="p in pages" :key="p.pageNumber" :info="p" :doc-ref="docHolder" />
    </div>
  </div>
</template>
