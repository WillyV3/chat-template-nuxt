<script setup lang="ts">
import { computed } from "vue";
import { Slider } from "@/components/ui/slider";
import { formatRadius, parseUnitValue } from "./typography-controls";

const props = defineProps<{ value: string; onChange: (next: string) => void }>();
const rem = computed(() => parseUnitValue(props.value));
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted-foreground">Corner radius</span>
      <span class="text-xs font-mono text-muted-foreground">{{ value }}</span>
    </div>
    <Slider
      :min="0"
      :max="2"
      :step="0.05"
      :model-value="[rem]"
      aria-label="Corner radius"
      @update:model-value="(v) => v && v[0] !== undefined && onChange(formatRadius(v[0]))"
    />
  </div>
</template>
