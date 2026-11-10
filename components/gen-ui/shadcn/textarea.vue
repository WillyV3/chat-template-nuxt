<script setup lang="ts">
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBound, useFieldCheck } from "./use-bound";

const props = defineProps<{
  label: string;
  name: string;
  placeholder?: string | null;
  rows?: number | null;
  value?: string | null;
  checks?: unknown[] | null;
  validateOn?: "change" | "blur" | "submit" | null;
  bindings?: Record<string, string>;
}>();
const value = useBound<string>(() => props.value, () => props.bindings?.value, "", () => "");
const { errors, has, validate, validateOn } = useFieldCheck(props.bindings?.value, props.checks, props.validateOn ?? "blur");
function onInput(v: string | number) {
  value.value = String(v);
  if (has && validateOn === "change") validate();
}
function onBlur() {
  if (has && validateOn === "blur") validate();
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="name ?? undefined">{{ label }}</Label>
    <Textarea
      :id="name ?? undefined"
      :name="name ?? undefined"
      :placeholder="placeholder ?? ''"
      :rows="rows ?? 3"
      :model-value="value"
      @update:model-value="onInput"
      @blur="onBlur"
    />
    <p v-if="errors.length > 0" class="text-sm text-destructive">{{ errors[0] }}</p>
  </div>
</template>
