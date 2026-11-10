<script setup lang="ts">
import { Toggle } from "@/components/ui/toggle";
import { useBound } from "./use-bound";

const props = defineProps<{
  label: string;
  pressed?: boolean | null;
  variant?: "default" | "outline" | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const pressed = useBound<boolean>(() => props.pressed, () => props.bindings?.pressed, props.pressed ?? false, () => false);
function onChange(v: boolean) {
  pressed.value = v;
  props.emit("change");
}
</script>

<template>
  <Toggle :variant="variant ?? 'default'" :model-value="pressed" @update:model-value="onChange">{{ label }}</Toggle>
</template>
