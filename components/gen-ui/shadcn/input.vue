<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBound, useFieldCheck } from "./use-bound";

const props = defineProps<{
  label: string;
  name: string;
  type?: "text" | "email" | "password" | "number" | null;
  placeholder?: string | null;
  value?: string | null;
  checks?: unknown[] | null;
  validateOn?: "change" | "blur" | "submit" | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const value = useBound<string>(() => props.value, () => props.bindings?.value, "", () => "");
const { errors, has, validate, validateOn } = useFieldCheck(props.bindings?.value, props.checks, props.validateOn ?? "blur");
function onInput(v: string | number) {
  value.value = String(v);
  if (has && validateOn === "change") validate();
}
function onBlur() {
  if (has && validateOn === "blur") validate();
  props.emit("blur");
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="name ?? undefined">{{ label }}</Label>
    <Input
      :id="name ?? undefined"
      :name="name ?? undefined"
      :type="type ?? 'text'"
      :placeholder="placeholder ?? ''"
      :model-value="value"
      @update:model-value="onInput"
      @keydown.enter="emit('submit')"
      @focus="emit('focus')"
      @blur="onBlur"
    />
    <p v-if="errors.length > 0" class="text-sm text-destructive">{{ errors[0] }}</p>
  </div>
</template>
