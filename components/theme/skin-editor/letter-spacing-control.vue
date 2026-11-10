<script setup lang="ts">
import { computed } from "vue";
import { Slider } from "@/components/ui/slider";
import { formatLetterSpacing, parseUnitValue } from "./typography-controls";

const props = defineProps<{ value: string; onChange: (next: string) => void }>();
const em = computed(() => (props.value === "normal" ? 0 : parseUnitValue(props.value)));
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted-foreground">Letter spacing</span>
      <span class="text-xs font-mono text-muted-foreground">{{ value }}</span>
    </div>
    <Slider
      :min="-0.05"
      :max="0.2"
      :step="0.005"
      :model-value="[em]"
      aria-label="Letter spacing"
      @update:model-value="(v) => v && v[0] !== undefined && onChange(formatLetterSpacing(v[0]))"
    />
  </div>
</template>
