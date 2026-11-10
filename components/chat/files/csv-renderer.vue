<script setup lang="ts">
import { computed } from "vue"
import DataTable from "./data-table.vue"
import { parseCsv } from "./file-viewer"

const props = defineProps<{ text: string; separator: string }>()

const rows = computed(() => parseCsv(props.text, props.separator))
const header = computed(() => rows.value[0] ?? [])
const body = computed(() => rows.value.slice(1))
</script>

<template>
  <div v-if="rows.length === 0" class="px-6 py-12 text-sm text-muted-foreground">
    Empty file.
  </div>
  <DataTable v-else :header="header" :body="body">
    <template #footnote>
      <p v-if="body.length > 1000" class="mt-3 font-mono text-[11px] text-muted-foreground">
        Showing first 1,000 of {{ body.length.toLocaleString() }} rows.
      </p>
    </template>
  </DataTable>
</template>
