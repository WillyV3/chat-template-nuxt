<script setup lang="ts">
// One font slot (sans/serif/mono/display) — a plain shadcn Select over the
// SAME allowlist validateSkinPayload enforces (THEME_WEBFONT_FAMILIES) plus
// the generic system-stack keywords. There is no free-text font field: the
// picker can only ever produce a value the security boundary already accepts.
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { THEME_WEBFONT_FAMILIES } from "@/lib/theme/theme-webfonts";

defineProps<{
  slotKey: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}>();

const SYSTEM_FONT_STACK_OPTIONS = [
  { value: "system-ui", label: "System UI" },
  { value: "ui-sans-serif", label: "System sans-serif" },
  { value: "ui-serif", label: "System serif" },
  { value: "ui-monospace", label: "System monospace" },
  { value: "sans-serif", label: "Generic sans-serif" },
  { value: "serif", label: "Generic serif" },
  { value: "monospace", label: "Generic monospace" },
];
</script>

<template>
  <div class="space-y-1.5">
    <Label :for="`font-${slotKey}`" class="text-xs text-muted-foreground">{{ label }}</Label>
    <Select :model-value="value" @update:model-value="(v) => onChange(String(v))">
      <SelectTrigger :id="`font-${slotKey}`" class="h-8 w-full text-sm" :style="{ fontFamily: value }">
        <SelectValue placeholder="Choose a font" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="f in THEME_WEBFONT_FAMILIES" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</SelectItem>
        <SelectItem v-for="f in SYSTEM_FONT_STACK_OPTIONS" :key="f.value" :value="f.value">{{ f.label }}</SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
