<script setup lang="ts">
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBound } from "./use-bound";

const props = defineProps<{
  tabs: { label: string; value: string }[];
  defaultValue?: string | null;
  value?: string | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const value = useBound<string>(
  () => props.value,
  () => props.bindings?.value,
  props.defaultValue ?? props.tabs?.[0]?.value ?? "",
  () => props.tabs?.[0]?.value ?? "",
);
function onChange(v: string | number) {
  value.value = String(v);
  props.emit("change");
}
</script>

<template>
  <Tabs :model-value="value" @update:model-value="onChange">
    <TabsList>
      <TabsTrigger v-for="tab in tabs ?? []" :key="tab.value" :value="tab.value">{{ tab.label }}</TabsTrigger>
    </TabsList>
    <slot />
  </Tabs>
</template>
