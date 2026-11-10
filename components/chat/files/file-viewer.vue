<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { AnimatePresence, motion } from "motion-v"
import {
  Download,
  Trash2,
  Copy,
  Check,
  Loader2,
  ArrowLeft,
  CornerDownLeft,
} from "@lucide/vue"
import type { BundledLanguage } from "shiki"

import Hint from "@/components/chat/ui/hint.vue"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

import BlobRenderer from "./blob-renderer.vue"
import CodeRenderer from "./code-renderer.vue"
import CsvRenderer from "./csv-renderer.vue"
import DocxRenderer from "./docx-renderer.vue"
import DownloadCard from "./download-card.vue"
import ExtensionBadge from "./extension-badge.vue"
import HtmlRenderer from "./html-renderer.vue"
import JsonRenderer from "./json-renderer.vue"
import MarkdownRenderer from "./markdown-renderer.vue"
import MediaRenderer from "./media-renderer.vue"
import NoteRenderer from "./note-renderer.vue"
import PlainTextRenderer from "./plain-text-renderer.vue"
import SheetRenderer from "./sheet-renderer.vue"
import { fileDownloadUrl, formatSize, getExtension, type FileEntry } from "./file-viewer"
import { classifyFile, resolveLang, CONVERTIBLE_EXTS } from "./viewer-model"

const props = defineProps<{
  file: FileEntry | null
  agentUrl?: string
  token?: string
  fileCount: number
  onDownload: (f: FileEntry) => void
  /** Optional: omit in read-only contexts (the chat Files panel) — the delete
   *  button then doesn't render. Management lives on the full Files page. */
  onDelete?: (f: FileEntry) => void
  /** Optional: when set, a "Add to chat" action appears in the header, so a
   *  file being previewed can be attached without leaving the viewer. */
  onAddToChat?: (f: FileEntry) => void
  /** When provided, renders a back-arrow in the header (used on mobile list-detail). */
  onBack?: () => void
}>()

const loading = ref(false)
const textContent = ref("")
const blobUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const copied = ref(false)
let lastBlob: string | null = null

const kind = computed(() => (props.file ? classifyFile(props.file.name, props.file.mime_type) : null))
const ext = computed(() => (props.file ? getExtension(props.file.name) : ""))
const baseName = computed(() =>
  props.file && ext.value
    ? props.file.name.slice(0, props.file.name.length - ext.value.length - 1)
    : (props.file?.name ?? ""),
)

// Load content for the selected file
watch(
  () => [props.file?.name, props.file?.path, props.agentUrl, props.token, kind.value] as const,
  (_n, _o, onCleanup) => {
    error.value = null
    textContent.value = ""
    // Reset up front: kinds that fetch re-set it, kinds that early-return
    // below (docx/sheet, non-convertible binary) must not inherit a stale
    // `true` from a cancelled predecessor whose .finally never ran.
    loading.value = false
    if (lastBlob) {
      URL.revokeObjectURL(lastBlob)
      lastBlob = null
      blobUrl.value = null
    }
    const file = props.file
    const { agentUrl, token } = props
    const k = kind.value
    if (!file || !agentUrl || !token || !k) return

    // docx/xlsx parse client-side — DocxRenderer/SheetRenderer own their own
    // fetch + parse so mammoth/exceljs stay lazy. Nothing to load here.
    if (k === "docx" || k === "sheet") return

    // cancelled guard (audit #2): file A→B switches WITHOUT a remount, so
    // A's late resolution could paint into B's viewer and overwrite
    // lastBlob with an orphaned (leaked) blob URL after B's cleanup ran.
    let cancelled = false
    const url = fileDownloadUrl(agentUrl, file)
    const cleanup = () => {
      cancelled = true
      if (lastBlob) {
        URL.revokeObjectURL(lastBlob)
        lastBlob = null
      }
    }

    // Binary office docs: fetch the file, convert it to PDF via /api/preview,
    // and render that PDF. Any failure falls through to the download card.
    if (k === "binary") {
      // zip/heic/pages/… aren't convertible (mirrors the route's allowlist) —
      // skip the pointless download and let the card render immediately.
      if (!CONVERTIBLE_EXTS.has(getExtension(file.name))) return
      loading.value = true
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const fileBlob = await res.blob()
          const conv = await fetch(
            `/api/preview?ext=${encodeURIComponent(getExtension(file.name))}`,
            { method: "POST", body: fileBlob },
          )
          if (!conv.ok) throw new Error(`preview HTTP ${conv.status}`)
          const pdfBlob = await conv.blob()
          if (cancelled) return
          const u = URL.createObjectURL(pdfBlob)
          lastBlob = u
          blobUrl.value = u
        })
        .catch(() => {
          // converter unavailable/failed → the download card renders instead
        })
        .finally(() => {
          if (!cancelled) loading.value = false
        })
      onCleanup(cleanup)
      return
    }

    const needsBlob = k === "image" || k === "pdf" || k === "video" || k === "audio"
    loading.value = true

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        if (needsBlob) {
          const blob = await res.blob()
          if (cancelled) return
          const u = URL.createObjectURL(blob)
          lastBlob = u
          blobUrl.value = u
        } else {
          const t = await res.text()
          if (!cancelled) textContent.value = t
        }
      })
      .catch((e) => {
        if (!cancelled) error.value = String(e)
      })
      .finally(() => {
        if (!cancelled) loading.value = false
      })

    onCleanup(cleanup)
  },
  { immediate: true },
)

let copyTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(copyTimer))

function handleCopy() {
  if (!props.file) return
  navigator.clipboard.writeText(props.file.name).catch(() => {})
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1200)
}

const lang = computed(() => resolveLang(ext.value) ?? ("text" as BundledLanguage))
const downloadFile = () => props.file && props.onDownload(props.file)
</script>

<template>
  <div v-if="!file" class="flex h-full flex-col">
    <div class="flex h-full items-center justify-center p-8">
      <Empty class="border-none">
        <EmptyHeader>
          <EmptyTitle class="font-serif italic text-foreground/70">
            {{ fileCount === 0 ? "No files yet." : "Choose a file to preview." }}
          </EmptyTitle>
          <EmptyDescription>
            {{
              fileCount === 0
                ? "Files your agent creates will show up here. You can upload your own too."
                : fileCount === 1
                  ? "1 file in your workspace."
                  : `${fileCount.toLocaleString()} files in your workspace.`
            }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  </div>

  <div v-else class="flex h-full flex-col">
    <header class="border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 sm:py-5">
      <div class="flex items-start gap-3">
        <Button
          v-if="onBack"
          variant="ghost"
          size="sm"
          class="-ml-2 h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
          aria-label="Back to file list"
          @click="onBack()"
        >
          <ArrowLeft class="size-4" />
        </Button>
        <div class="min-w-0 flex-1">
          <h1 class="flex items-baseline gap-2 font-display text-lg font-medium leading-tight tracking-tight sm:text-2xl">
            <span class="truncate">{{ baseName }}</span>
            <ExtensionBadge :ext="ext" class="translate-y-[-2px] text-[11px]" />
          </h1>
          <p class="mt-1 truncate text-xs text-muted-foreground">
            {{ formatSize(file.size) }}
          </p>
        </div>

        <!-- Icon-only actions: Hint supplies both the tooltip and the accessible
             name. Native title= gave neither on touch. -->
        <div class="flex shrink-0 items-center gap-1">
          <Hint :label="copied ? 'Copied' : 'Copy filename'">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2 text-muted-foreground hover:text-foreground"
              @click="handleCopy"
            >
              <Check v-if="copied" class="size-3.5 text-primary" />
              <Copy v-else class="size-3.5" />
            </Button>
          </Hint>
          <Hint v-if="onAddToChat" label="Add to chat">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-1.5 px-2 text-primary hover:text-primary"
              @click="onAddToChat(file)"
            >
              <CornerDownLeft class="size-3.5" />
              <span class="text-xs font-medium">Add</span>
            </Button>
          </Hint>
          <Hint label="Download">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2 text-muted-foreground hover:text-foreground"
              @click="downloadFile"
            >
              <Download class="size-3.5" />
            </Button>
          </Hint>
          <Hint v-if="onDelete" label="Delete">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2 text-muted-foreground hover:text-destructive"
              @click="onDelete(file)"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </Hint>
        </div>
      </div>
    </header>

    <div class="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          :key="file.name"
          :initial="{ opacity: 0, y: 4 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: -2 }"
          :transition="{ duration: 0.12, ease: 'easeOut' }"
          class="h-full"
        >
          <div v-if="loading" class="flex items-center gap-2 px-6 py-10 text-xs text-muted-foreground">
            <Loader2 class="size-3.5 animate-spin" /> Loading…
          </div>
          <!-- Plain language, no error codes — the calm card beats a red alert with
               an HTTP status a non-technical user can't act on. -->
          <DownloadCard v-else-if="error" :file="file" :on-download="downloadFile" failed />
          <MarkdownRenderer v-else-if="kind === 'markdown'" :text="textContent" />
          <HtmlRenderer v-else-if="kind === 'html'" :text="textContent" />
          <CsvRenderer
            v-else-if="kind === 'csv'"
            :text="textContent"
            :separator="ext === 'tsv' ? '\t' : ','"
          />
          <JsonRenderer v-else-if="kind === 'json'" :text="textContent" :name="file.name" />
          <CodeRenderer v-else-if="kind === 'code'" :text="textContent" :lang="lang" />
          <BlobRenderer v-else-if="kind === 'image' && blobUrl" :blob-url="blobUrl" kind="image" :alt="file.name" />
          <MediaRenderer
            v-else-if="(kind === 'video' || kind === 'audio') && blobUrl"
            :blob-url="blobUrl"
            :kind="kind"
            :file="file"
            :on-download="downloadFile"
          />
          <DocxRenderer
            v-else-if="kind === 'docx' && agentUrl && token"
            :url="fileDownloadUrl(agentUrl, file)"
            :token="token"
            :file="file"
            :on-download="downloadFile"
          />
          <SheetRenderer
            v-else-if="kind === 'sheet' && agentUrl && token"
            :url="fileDownloadUrl(agentUrl, file)"
            :token="token"
            :file="file"
            :on-download="downloadFile"
          />
          <!-- A "binary" blobUrl is an Office doc converted to PDF by
               /api/preview — render it like any PDF. -->
          <BlobRenderer v-else-if="(kind === 'pdf' || kind === 'binary') && blobUrl" :blob-url="blobUrl" kind="pdf" :alt="file.name" />
          <!-- No preview available (conversion failed, or no agent creds) → honest card. -->
          <DownloadCard
            v-else-if="kind === 'binary' || kind === 'docx' || kind === 'sheet' || kind === 'video' || kind === 'audio'"
            :file="file"
            :on-download="downloadFile"
          />
          <NoteRenderer v-else-if="kind === 'note'" :text="textContent" />
          <PlainTextRenderer v-else :text="textContent" />
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
</template>
