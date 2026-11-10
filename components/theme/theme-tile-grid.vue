<script setup lang="ts">
// Shared tile grid for anything Theme-shaped — the catalog picker AND the
// Community gallery render through this ONE component (a community skin
// resolves to a plain Theme, so there is no second rendering path to build).
// The swatch bar IS the preview everywhere in this app; never a faux
// screenshot.
import { Check } from "@lucide/vue";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/theme/themes";
import ThemeSwatchBar from "./theme-swatch-bar.vue";

defineProps<{
  themes: Theme[];
  selectedId: string;
  onSelect: (theme: Theme) => void;
  disabled?: boolean;
  emptyMessage: string;
}>();
</script>

<template>
  <p v-if="themes.length === 0" class="py-6 text-center text-xs text-muted-foreground">{{ emptyMessage }}</p>
  <div v-else class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
    <button
      v-for="t in themes"
      :key="t.id"
      type="button"
      :disabled="disabled"
      :aria-pressed="t.id === selectedId"
      :aria-label="`Use the ${t.label} skin`"
      :class="cn(
        'group flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        t.id === selectedId
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border hover:border-primary/40 hover:bg-muted/40',
      )"
      @click="onSelect(t)"
    >
      <ThemeSwatchBar :swatch="t.swatch" />
      <span class="flex items-center justify-between gap-1">
        <span class="truncate text-xs font-medium">{{ t.label }}</span>
        <Check v-if="t.id === selectedId" class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      </span>
    </button>
  </div>
</template>
