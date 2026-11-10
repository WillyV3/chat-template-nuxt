<script setup lang="ts">
import { computed } from "vue";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const props = defineProps<{ columns: string[]; rows: string[][]; caption?: string | null }>();
const rows = computed(() => (props.rows ?? []).map((row) => row.map(String)));
</script>

<template>
  <div class="rounded-md border border-border overflow-hidden">
    <Table>
      <TableCaption v-if="caption">{{ caption }}</TableCaption>
      <TableHeader>
        <TableRow><TableHead v-for="col in columns ?? []" :key="col">{{ col }}</TableHead></TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, i) in rows" :key="i"><TableCell v-for="(cell, j) in row" :key="j">{{ cell }}</TableCell></TableRow>
      </TableBody>
    </Table>
  </div>
</template>
