<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useBound } from "./use-bound";

const props = defineProps<{
  label?: string | null;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  value?: number | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const value = useBound<number>(() => props.value, () => props.bindings?.value, props.min ?? 0, () => props.min ?? 0);
function onChange(v: number[] | undefined) {
  value.value = v?.[0] ?? 0;
  props.emit("change");
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="label" class="flex justify-between">
      <Label class="text-sm">{{ label }}</Label>
      <span class="text-sm text-muted-foreground">{{ value }}</span>
    </div>
    <Slider :model-value="[value]" :min="min ?? 0" :max="max ?? 100" :step="step ?? 1" @update:model-value="onChange" />
  </div>
</template>
