<script setup lang="ts">
import { computed } from "vue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBound } from "./use-bound";

const props = defineProps<{
  items: { label: string; value: string }[];
  type?: "single" | "multiple" | null;
  value?: string | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
// Multiple stores a comma-joined string, same as the React component.
const value = useBound<string>(() => props.value, () => props.bindings?.value, props.items?.[0]?.value ?? "", () => "");
const multiple = computed(() => (props.type ?? "single") === "multiple");
const selected = computed(() => (value.value ? value.value.split(",").filter(Boolean) : []));
function onMultiple(v: unknown) {
  value.value = ((v as string[] | undefined) ?? []).join(",");
  props.emit("change");
}
function onSingle(v: unknown) {
  if (v) {
    value.value = String(v);
    props.emit("change");
  }
}
</script>

<template>
  <ToggleGroup v-if="multiple" type="multiple" :model-value="selected" @update:model-value="onMultiple">
    <ToggleGroupItem v-for="item in items ?? []" :key="item.value" :value="item.value">{{ item.label }}</ToggleGroupItem>
  </ToggleGroup>
  <ToggleGroup v-else type="single" :model-value="value" @update:model-value="onSingle">
    <ToggleGroupItem v-for="item in items ?? []" :key="item.value" :value="item.value">{{ item.label }}</ToggleGroupItem>
  </ToggleGroup>
</template>
