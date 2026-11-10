<script setup lang="ts">
import { computed } from "vue";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useStateStore } from "@json-render/vue";

const props = defineProps<{
  totalPages: number;
  page?: number | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
// Like React: no local page. The current page is the prop (bound or static); a click only writes when bound.
const { set } = useStateStore();
const page = computed(() => props.page ?? 1);
const total = computed(() => props.totalPages ?? 1);

// Same window as the React component (not reka's own range).
const pages = computed<(number | "ellipsis")[]>(() => {
  const current = page.value;
  const t = total.value;
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const out: (number | "ellipsis")[] = [1];
  if (current > 3) out.push("ellipsis");
  for (let i = Math.max(2, current - 1); i <= Math.min(t - 1, current + 1); i++) out.push(i);
  if (current < t - 2) out.push("ellipsis");
  out.push(t);
  return out;
});
function go(n: number) {
  if (n === page.value || n < 1 || n > total.value) return;
  if (props.bindings?.page) set(props.bindings.page, n);
  props.emit("change");
}
</script>

<template>
  <Pagination :page="page" :total="total" :items-per-page="1" @update:page="go">
    <PaginationContent>
      <PaginationPrevious />
      <template v-for="(p, idx) in pages" :key="p === 'ellipsis' ? `ellipsis-${idx}` : p">
        <PaginationEllipsis v-if="p === 'ellipsis'" />
        <PaginationItem v-else :value="p" :is-active="p === page">{{ p }}</PaginationItem>
      </template>
      <PaginationNext />
    </PaginationContent>
  </Pagination>
</template>
