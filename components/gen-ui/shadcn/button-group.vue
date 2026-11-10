<script setup lang="ts">
import { useBound } from "./use-bound";

const props = defineProps<{
  buttons: { label: string; value: string }[];
  selected?: string | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const value = useBound<string>(() => props.selected, () => props.bindings?.selected, props.buttons?.[0]?.value ?? "", () => "");
function pick(v: string) {
  value.value = v;
  props.emit("change");
}
</script>

<template>
  <div class="inline-flex rounded-md border border-border">
    <button
      v-for="(btn, i) in buttons ?? []"
      :key="btn.value"
      :class="`px-3 py-1.5 text-sm transition-colors ${value === btn.value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'} ${i > 0 ? 'border-l border-border' : ''} ${i === 0 ? 'rounded-l-md' : ''} ${i === buttons.length - 1 ? 'rounded-r-md' : ''}`"
      @click="pick(btn.value)"
    >
      {{ btn.label }}
    </button>
  </div>
</template>
