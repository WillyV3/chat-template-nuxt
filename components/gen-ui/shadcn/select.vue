<script setup lang="ts">
import { computed } from "vue";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBound, useFieldCheck } from "./use-bound";

const props = defineProps<{
  label: string;
  name: string;
  options: string[];
  placeholder?: string | null;
  value?: string | null;
  checks?: unknown[] | null;
  validateOn?: "change" | "blur" | "submit" | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const value = useBound<string>(() => props.value, () => props.bindings?.value, "", () => "");
const options = computed(() => (props.options ?? []).map((o) => (typeof o === "string" ? o : String(o ?? ""))));
const { errors, has, validate, validateOn } = useFieldCheck(props.bindings?.value, props.checks, props.validateOn ?? "change");
function onChange(v: unknown) {
  value.value = String(v ?? "");
  if (has && validateOn === "change") validate();
  props.emit("change");
}
</script>

<template>
  <div class="space-y-2">
    <Label>{{ label }}</Label>
    <Select :model-value="value" @update:model-value="onChange">
      <SelectTrigger class="w-full"><SelectValue :placeholder="placeholder ?? 'Select...'" /></SelectTrigger>
      <SelectContent>
        <SelectItem v-for="(opt, idx) in options" :key="`${idx}-${opt}`" :value="opt || `option-${idx}`">{{ opt }}</SelectItem>
      </SelectContent>
    </Select>
    <p v-if="errors.length > 0" class="text-sm text-destructive">{{ errors[0] }}</p>
  </div>
</template>
