<script setup lang="ts">
// The "Colors" accordion — one AccordionItem per group (token-schema.ts),
// each listing its tokens as ColorTokenField rows for whichever mode
// (light/dark) the SAME toggle driving the preview is currently on. Editing
// and previewing the same mode at once is the point — no separate per-row
// light/dark switch to keep track of.
import { computed } from "vue";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ColorTokenField from "./color-token-field.vue";
import { COLOR_TOKEN_GROUPS, tokenLabel } from "./token-schema";
import type { SkinDraftMode } from "./use-skin-draft";

const props = defineProps<{
  light: Record<string, string>;
  dark: Record<string, string>;
  mode: SkinDraftMode;
  onChange: (mode: SkinDraftMode, key: string, value: string) => void;
}>();
const tokens = computed(() => (props.mode === "light" ? props.light : props.dark));
</script>

<template>
  <Accordion type="multiple" :default-value="['base', 'primary']">
    <AccordionItem v-for="group in COLOR_TOKEN_GROUPS" :key="group.id" :value="group.id">
      <AccordionTrigger class="py-2.5 text-sm">{{ group.label }}</AccordionTrigger>
      <AccordionContent>
        <div class="space-y-3">
          <div v-for="key in group.keys" :key="key" class="space-y-1">
            <span class="text-xs text-muted-foreground">{{ tokenLabel(key) }}</span>
            <ColorTokenField
              :token-key="`${mode}-${key}`"
              :label="`${tokenLabel(key)} (${mode})`"
              :value="tokens[key] ?? ''"
              :on-change="(v) => onChange(mode, key, v)"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
