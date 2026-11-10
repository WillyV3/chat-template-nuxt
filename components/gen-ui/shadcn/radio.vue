<script setup lang="ts">
import { computed } from "vue";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBound, useFieldCheck } from "./use-bound";

const props = defineProps<{
  label: string;
  name: string;
  options: string[];
  value?: string | null;
  checks?: unknown[] | null;
  validateOn?: "change" | "blur" | "submit" | null;
  bindings?: Record<string, string>;
  emit: (event: string) => void;
}>();
const options = computed(() => (props.options ?? []).map((o) => (typeof o === "string" ? o : String(o ?? ""))));
const value = useBound<string>(() => props.value, () => props.bindings?.value, options.value[0] ?? "", () => "");
const { errors, has, validate, validateOn } = useFieldCheck(props.bindings?.value, props.checks, props.validateOn ?? "change");
function onChange(v: unknown) {
  value.value = String(v ?? "");
  if (has && validateOn === "change") validate();
  props.emit("change");
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label">{{ label }}</Label>
    <RadioGroup :model-value="value" @update:model-value="onChange">
      <div v-for="(opt, idx) in options" :key="`${idx}-${opt}`" class="flex items-center space-x-2">
        <RadioGroupItem :value="opt || `option-${idx}`" :id="`${name}-${idx}-${opt}`" />
        <Label :for="`${name}-${idx}-${opt}`" class="cursor-pointer">{{ opt }}</Label>
      </div>
    </RadioGroup>
    <p v-if="errors.length > 0" class="text-sm text-destructive">{{ errors[0] }}</p>
  </div>
</template>
