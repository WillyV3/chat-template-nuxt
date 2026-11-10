<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBound, useFieldCheck } from "./use-bound";

const props = defineProps<{
  label: string;
  name: string;
  checked?: boolean | null;
  checks?: unknown[] | null;
  validateOn?: "change" | "blur" | "submit" | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const checked = useBound<boolean>(() => props.checked, () => props.bindings?.checked, !!props.checked, () => false);
const { errors, has, validate, validateOn } = useFieldCheck(props.bindings?.checked, props.checks, props.validateOn ?? "change");
function onChange(c: boolean) {
  checked.value = c;
  if (has && validateOn === "change") validate();
  props.emit("change");
}
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center justify-between space-x-2">
      <Label :for="name ?? undefined" class="cursor-pointer">{{ label }}</Label>
      <Switch :id="name ?? undefined" :model-value="checked" @update:model-value="onChange" />
    </div>
    <p v-if="errors.length > 0" class="text-sm text-destructive">{{ errors[0] }}</p>
  </div>
</template>
