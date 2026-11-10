<script lang="ts">
export type PdfPageInfo = { pageNumber: number; aspect: number }
export type PdfDocHolder = {
  current: { getPage: (n: number) => Promise<unknown> } | null
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ info: PdfPageInfo; docRef: PdfDocHolder }>()

const holderRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendered = ref(false)

let cancel = false
let io: IntersectionObserver | null = null

onMounted(() => {
  const holder = holderRef.value
  if (!holder) return
  io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io?.disconnect()
      void (async () => {
        const doc = props.docRef.current
        const canvas = canvasRef.value
        if (!doc || !canvas) return
        try {
          const page = (await doc.getPage(props.info.pageNumber)) as {
            getViewport: (o: { scale: number }) => { width: number; height: number }
            render: (o: {
              canvasContext: CanvasRenderingContext2D
              viewport: unknown
            }) => { promise: Promise<void> }
          }
          if (cancel) return
          const width = holder.clientWidth
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const base = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (width / base.width) * dpr })
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext("2d")
          if (!ctx) return
          await page.render({ canvasContext: ctx, viewport }).promise
          if (!cancel) rendered.value = true
        } catch {
          // A single busted page stays a placeholder; the rest still render.
        }
      })()
    },
    { rootMargin: "600px" },
  )
  io.observe(holder)
})

onBeforeUnmount(() => {
  cancel = true
  io?.disconnect()
})
</script>

<template>
  <div
    ref="holderRef"
    class="w-full overflow-hidden rounded-md bg-white shadow-sm"
    :style="{ aspectRatio: info.aspect }"
  >
    <canvas
      ref="canvasRef"
      :class="cn('h-full w-full transition-opacity duration-300', rendered ? 'opacity-100' : 'opacity-0')"
    />
  </div>
</template>
