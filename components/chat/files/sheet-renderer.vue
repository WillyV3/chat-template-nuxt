<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { cn } from "@/lib/utils"
import DataTable from "./data-table.vue"
import DownloadCard from "./download-card.vue"
import InlineLoader from "./inline-loader.vue"
import {
  interopDefault,
  worksheetToSheet,
  type FileEntry,
  type ParsedSheet,
} from "./file-viewer"
import { SHEET_ROW_CAP } from "./viewer-model"

const props = defineProps<{
  url: string
  token: string
  file: FileEntry
  onDownload: () => void
}>()

const sheets = ref<ParsedSheet[] | null>(null)
const active = ref(0)
const failed = ref(false)

watch(
  () => [props.url, props.token] as const,
  ([url, token], _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    sheets.value = null
    failed.value = false
    active.value = 0
    ;(async () => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      // Lazy: exceljs only loads when a .xlsx is actually opened.
      const { Workbook } = interopDefault(await import("exceljs"))
      const wb = new Workbook()
      await wb.xlsx.load(buf)
      if (cancelled) return
      const parsed = wb.worksheets.map(worksheetToSheet)
      if (parsed.length === 0) throw new Error("workbook has no sheets")
      const tab = wb.views?.[0]?.activeTab
      sheets.value = parsed
      active.value =
        typeof tab === "number" ? Math.min(Math.max(tab, 0), parsed.length - 1) : 0
    })().catch(() => {
      if (!cancelled) failed.value = true
    })
  },
  { immediate: true },
)

const sheet = computed(() => sheets.value?.[active.value] ?? sheets.value?.[0])
const header = computed(() => sheet.value?.header ?? [])
const rows = computed(() => sheet.value?.rows ?? [])
</script>

<template>
  <DownloadCard v-if="failed" :file="file" :on-download="onDownload" failed />
  <InlineLoader v-else-if="!sheets || !sheet" label="Preparing spreadsheet…" />
  <div v-else>
    <div v-if="sheets.length > 1" class="flex gap-1 overflow-x-auto px-4 pt-4 sm:px-6">
      <button
        v-for="(s, i) in sheets"
        :key="i"
        :class="cn(
          'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          i === active
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )"
        @click="active = i"
      >
        {{ s.name }}
      </button>
    </div>
    <div v-if="header.length === 0 && rows.length === 0" class="px-6 py-12 text-sm text-muted-foreground">
      Empty sheet.
    </div>
    <DataTable v-else :header="header" :body="rows">
      <template #footnote>
        <p v-if="sheet.truncated" class="mt-3 font-mono text-[11px] text-muted-foreground">
          Showing {{ SHEET_ROW_CAP.toLocaleString() }} of
          {{ sheet.totalDataRows.toLocaleString() }} rows — download for the rest.
        </p>
      </template>
    </DataTable>
  </div>
</template>
