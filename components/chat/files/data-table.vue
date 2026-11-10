<script setup lang="ts">
/** Shared presentational table for tabular files (CSV/TSV + spreadsheets):
 *  sticky header, numeric-column detection, click-to-sort, 1,000-row render
 *  cap. Callers supply their own footnote via the `footnote` slot. */
import { computed, ref } from "vue"
import { ChevronDown, ChevronUp } from "@lucide/vue"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { isNumeric } from "./file-viewer"

const props = defineProps<{ header: string[]; body: string[][] }>()

const numericCols = computed(() =>
  props.header.map((_, c) => {
    let count = 0
    let total = 0
    for (const r of props.body.slice(0, 200)) {
      if (r[c] != null && r[c] !== "") {
        total++
        if (isNumeric(r[c])) count++
      }
    }
    return total > 0 && count / total > 0.8
  }),
)

const sortBy = ref<{ col: number; dir: "asc" | "desc" } | null>(null)

const sorted = computed(() => {
  if (!sortBy.value) return props.body
  const { col, dir } = sortBy.value
  const out = [...props.body]
  out.sort((a, b) => {
    const av = a[col] ?? ""
    const bv = b[col] ?? ""
    if (numericCols.value[col]) {
      return (Number(av) - Number(bv)) * (dir === "asc" ? 1 : -1)
    }
    return av.localeCompare(bv) * (dir === "asc" ? 1 : -1)
  })
  return out
})

function toggleSort(i: number) {
  const s = sortBy.value
  sortBy.value =
    s?.col === i ? { col: i, dir: s.dir === "asc" ? "desc" : "asc" } : { col: i, dir: "asc" }
}
</script>

<template>
  <div class="px-4 py-4 sm:px-6">
    <div class="rounded-lg border">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-muted backdrop-blur supports-[backdrop-filter]:bg-muted/70">
          <TableRow>
            <TableHead
              v-for="(h, i) in header"
              :key="i"
              :class="cn(
                'cursor-pointer font-mono text-[11px] uppercase tracking-wider transition-colors hover:text-foreground',
                numericCols[i] && 'text-right',
                sortBy?.col === i ? 'text-foreground' : 'text-muted-foreground',
              )"
              @click="toggleSort(i)"
            >
              <span class="inline-flex items-center gap-1">
                {{ h || `col_${i + 1}` }}
                <template v-if="sortBy?.col === i">
                  <ChevronUp v-if="sortBy?.dir === 'asc'" class="size-3" />
                  <ChevronDown v-else class="size-3" />
                </template>
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(r, ri) in sorted.slice(0, 1000)" :key="ri">
            <TableCell
              v-for="(_, ci) in header"
              :key="ci"
              :class="cn('align-top', numericCols[ci] && 'text-right font-mono tabular-nums')"
            >
              {{ r[ci] ?? "" }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <slot name="footnote" />
  </div>
</template>
