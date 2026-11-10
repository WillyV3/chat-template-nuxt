<script setup lang="ts">
import { computed } from "vue";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

const props = defineProps<{ value: number; max?: number | null; label?: string | null }>();
const value = computed(() => Math.min(100, Math.max(0, props.value || 0)));
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" class="text-sm text-muted-foreground">{{ label }}</Label>
    <Progress :model-value="value" />
  </div>
</template>
